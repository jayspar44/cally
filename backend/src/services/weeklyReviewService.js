const { db } = require('./firebase');
const { getGoalsForDate } = require('./goalsService');
const { getLogger } = require('../logger');
const { getTodayStr, parseLocalDate, toDateStr } = require('../utils/dateUtils');
const { genAI, MODELS } = require('./geminiService');
const admin = require('firebase-admin');

/**
 * Check if today is the user's review day and they haven't had a review today.
 */
const shouldTriggerReview = async (userId, timezone = 'America/New_York') => {
    const logger = getLogger();
    const tz = timezone;

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const reviewDay = userData.settings?.weeklyReviewDay || 'sunday';

        // Get current day of week in user's timezone
        const now = new Date();
        const dayName = now.toLocaleString('en-US', { timeZone: tz, weekday: 'long' }).toLowerCase();

        if (dayName !== reviewDay) {
            return false;
        }

        // Check if already reviewed today
        const today = getTodayStr(tz);
        if (userData.lastWeeklyReview === today) {
            return false;
        }

        return true;
    } catch (error) {
        logger.error({ err: error, userId }, 'Failed to check weekly review trigger');
        return false;
    }
};

/**
 * Fetch food logs for a date range.
 */
const getLogsForRange = async (userId, startDate, endDate) => {
    const snapshot = await db.collection('users').doc(userId)
        .collection('foodLogs')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .limit(500)
        .get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Sum nutrition values from an array of logs.
 */
const sumLogs = (logs) => logs.reduce((acc, log) => ({
    calories: acc.calories + (log.calories || 0),
    protein: acc.protein + (log.protein || 0),
    carbs: acc.carbs + (log.carbs || 0),
    fat: acc.fat + (log.fat || 0),
    count: acc.count + 1,
}), { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 });

/**
 * Generate a weekly review and store it as a chat message.
 */
const generateWeeklyReview = async (userId, timezone = 'America/New_York', { force = false, skipChatMessage = false } = {}) => {
    const logger = getLogger();
    const tz = timezone;
    const today = getTodayStr(tz);

    try {
        // 1. Claim the review slot atomically to prevent duplicates
        const userDocRef = db.collection('users').doc(userId);
        let userData;
        if (force) {
            const snap = await userDocRef.get();
            userData = snap.exists ? snap.data() : {};
            await userDocRef.set({ lastWeeklyReview: today }, { merge: true });
        } else {
            try {
                await db.runTransaction(async (txn) => {
                    const snap = await txn.get(userDocRef);
                    userData = snap.exists ? snap.data() : {};
                    if (userData.lastWeeklyReview === today) {
                        throw new Error('ALREADY_REVIEWED');
                    }
                    txn.update(userDocRef, { lastWeeklyReview: today });
                });
            } catch (txnErr) {
                if (txnErr.message === 'ALREADY_REVIEWED') {
                    logger.info({ userId }, 'Weekly review already generated today, skipping');
                    return null;
                }
                throw txnErr;
            }
        }

        const firstName = userData.firstName || '';
        const settings = userData.settings || {};

        const goals = await getGoalsForDate(userId, today, settings);

        // 2. Compute date ranges for this week and previous week
        const todayDate = parseLocalDate(today);
        const thisWeekDates = [];
        const prevWeekDates = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(todayDate);
            d.setDate(d.getDate() - i);
            thisWeekDates.push(toDateStr(d));
        }
        for (let i = 13; i >= 7; i--) {
            const d = new Date(todayDate);
            d.setDate(d.getDate() - i);
            prevWeekDates.push(toDateStr(d));
        }

        const thisWeekStart = thisWeekDates[0];
        const thisWeekEnd = thisWeekDates[6];
        const prevWeekStart = prevWeekDates[0];
        const prevWeekEnd = prevWeekDates[6];

        // 3. Fetch logs for both weeks
        const [thisWeekLogs, prevWeekLogs] = await Promise.all([
            getLogsForRange(userId, thisWeekStart, thisWeekEnd),
            getLogsForRange(userId, prevWeekStart, prevWeekEnd),
        ]);

        // 4. Compute this week's stats (single-pass grouping)
        const thisWeekByDay = Object.fromEntries(thisWeekDates.map(d => [d, []]));
        for (const log of thisWeekLogs) {
            if (thisWeekByDay[log.date]) thisWeekByDay[log.date].push(log);
        }

        const daysTracked = Object.values(thisWeekByDay).filter(logs => logs.length > 0).length;
        const thisWeekTotal = sumLogs(thisWeekLogs);
        const thisWeekDailyAvg = daysTracked > 0 ? {
            calories: Math.round(thisWeekTotal.calories / daysTracked),
            protein: Math.round(thisWeekTotal.protein / daysTracked),
            carbs: Math.round(thisWeekTotal.carbs / daysTracked),
            fat: Math.round(thisWeekTotal.fat / daysTracked),
        } : { calories: 0, protein: 0, carbs: 0, fat: 0 };

        // Days within 10% of calorie target
        const daysOnTarget = Object.values(thisWeekByDay).filter(logs => {
            if (logs.length === 0) return false;
            const dayTotal = sumLogs(logs);
            return Math.abs(dayTotal.calories - goals.targetCalories) <= goals.targetCalories * 0.1;
        }).length;

        // Top foods by frequency
        const foodCounts = {};
        for (const log of thisWeekLogs) {
            const name = (log.name || '').toLowerCase().trim();
            if (name) foodCounts[name] = (foodCounts[name] || 0) + 1;
        }
        const topFoods = Object.entries(foodCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => `${name} (${count}x)`);

        // 5. Compute previous week's stats (single-pass grouping)
        const prevWeekByDay = Object.fromEntries(prevWeekDates.map(d => [d, []]));
        for (const log of prevWeekLogs) {
            if (prevWeekByDay[log.date]) prevWeekByDay[log.date].push(log);
        }
        const prevDaysTracked = Object.values(prevWeekByDay).filter(logs => logs.length > 0).length;
        const prevWeekTotal = sumLogs(prevWeekLogs);
        const prevWeekDailyAvg = prevDaysTracked > 0 ? {
            calories: Math.round(prevWeekTotal.calories / prevDaysTracked),
            protein: Math.round(prevWeekTotal.protein / prevDaysTracked),
            carbs: Math.round(prevWeekTotal.carbs / prevDaysTracked),
            fat: Math.round(prevWeekTotal.fat / prevDaysTracked),
        } : null;

        // 6. Build the Gemini prompt
        const prompt = `You are Kalli, a warm and knowledgeable AI nutrition coach. Write a weekly nutrition review for ${firstName || 'the user'}.

DATA FOR THIS WEEK (${thisWeekStart} to ${thisWeekEnd}):
- Days tracked: ${daysTracked}/7
- Days on calorie target (within 10%): ${daysOnTarget}/7
- Daily averages: ${thisWeekDailyAvg.calories} cal, ${thisWeekDailyAvg.protein}g protein, ${thisWeekDailyAvg.carbs}g carbs, ${thisWeekDailyAvg.fat}g fat
- Total items logged: ${thisWeekTotal.count}
- Most eaten foods: ${topFoods.length > 0 ? topFoods.join(', ') : 'none logged'}
- User's goals: ${goals.targetCalories} cal, ${goals.targetProtein}g protein, ${goals.targetCarbs}g carbs, ${goals.targetFat}g fat

${prevWeekDailyAvg ? `PREVIOUS WEEK (${prevWeekStart} to ${prevWeekEnd}):
- Days tracked: ${prevDaysTracked}/7
- Daily averages: ${prevWeekDailyAvg.calories} cal, ${prevWeekDailyAvg.protein}g protein, ${prevWeekDailyAvg.carbs}g carbs, ${prevWeekDailyAvg.fat}g fat` : 'PREVIOUS WEEK: No data available.'}

${userData.weeklyFocus?.label ? `LAST WEEK'S FOCUS: "${userData.weeklyFocus.label}"
Evaluate whether the user met this focus based on the data. Include one bullet point about it — did they hit it, partially, or miss it? Be specific.` : ''}

FORMAT — follow this structure exactly:

1. One short opening sentence — set the tone, reference the week casually
2. 4-6 bullet points (use "-") — each bullet is ONE specific observation with real numbers. Mix wins and areas to improve. Compare to last week where relevant. Keep each bullet to one sentence.
3. One short closing sentence — the main coaching takeaway or encouragement

Then on its own line:
WEEKLY FOCUS: [one specific, measurable goal for next week]

EXAMPLE OUTPUT:
Here's your week at a glance.

- Protein averaged 86g/day, up from 58g last week — solid improvement
- Only tracked 3 out of 7 days though, down from a full week before
- Calories came in at 1151/day when logging, well under your 2015 target
- Carbs sitting at 106g vs your 214g goal — you might be running low on fuel
- Barebells bars and broccoli showing up regularly, good protein-dense picks

Consistency is the biggest lever right now — when you do log, the picture is clear.

WEEKLY FOCUS: Log all 3 main meals for at least 5 days this week

RULES:
- No emojis, no bold section headers, no numbered lists
- Bullet points use "-" (not "*" or numbers)
- Each bullet: one insight, one sentence, real numbers from the data
- The WEEKLY FOCUS line MUST start with exactly "WEEKLY FOCUS:" (parsed programmatically)
- Be encouraging but honest
- Use contractions naturally (you're, that's, you've)
- The focus must be specific and measurable, not vague`;

        // 7. Call Gemini
        const result = await genAI.models.generateContent({
            model: MODELS.flash,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { temperature: 1.0, maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: 'LOW' } }
        });

        const reviewText = result.candidates?.[0]?.content?.parts?.find(p => p.text)?.text?.trim() || '';

        if (!reviewText) {
            throw new Error('Empty response from Gemini for weekly review');
        }

        // 8. Parse the weekly focus and strip it from the display text
        const focusMatch = reviewText.match(/WEEKLY FOCUS:\s*(.+)/i)
            || reviewText.match(/\*\*Next week's focus:\*\*\s*(.+)/i);
        const focusText = focusMatch ? focusMatch[1].trim() : null;

        // Remove the focus line (and any preceding ---) from the text shown in chat
        const displayText = reviewText
            .replace(/\n---\s*\n\*\*Next week's focus:\*\*.*/i, '')
            .replace(/\nWEEKLY FOCUS:\s*.*/i, '')
            .trim();

        // 9. Store the review as a chat message (skip when called from agent tool — the chat controller stores the response)
        let messageId = null;
        if (!skipChatMessage) {
            const chatHistoryRef = db.collection('users').doc(userId).collection('chatHistory');
            const reviewMessage = {
                role: 'assistant',
                content: displayText,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                metadata: {
                    type: 'weekly_review',
                    weekStart: thisWeekStart,
                    weekEnd: thisWeekEnd,
                    focus: focusText || null,
                    model: MODELS.flash,
                }
            };
            const msgDoc = await chatHistoryRef.add(reviewMessage);
            messageId = msgDoc.id;
        }

        // 10. Store the focus (lastWeeklyReview already set in transaction above)
        if (focusText) {
            const focusData = {
                label: focusText,
                setAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (messageId) focusData.reviewMessageId = messageId;
            await db.collection('users').doc(userId).update({ weeklyFocus: focusData });
        }

        logger.info({
            userId,
            messageId,
            daysTracked,
            daysOnTarget,
            hasFocus: !!focusText,
        }, 'Weekly review generated');

        return {
            message: displayText,
            focus: focusText,
            messageId,
        };
    } catch (error) {
        logger.error({ err: error, userId }, 'Failed to generate weekly review');
        throw error;
    }
};

module.exports = { shouldTriggerReview, generateWeeklyReview };
