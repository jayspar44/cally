const { GoogleGenAI } = require('@google/genai');
const { db } = require('./firebase');
const { getGoalsForDate } = require('./goalsService');
const { getLogger } = require('../logger');
const { getTodayStr, parseLocalDate, toDateStr } = require('../utils/dateUtils');
const admin = require('firebase-admin');

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const MODEL = 'gemini-3-flash-preview';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Check if today is the user's review day and they haven't had a review today.
 */
const shouldTriggerReview = async (userId, timezone) => {
    const logger = getLogger();
    const tz = timezone || 'America/New_York';

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const reviewDay = userData.settings?.weeklyReviewDay || 'sunday';

        // Get current day of week in user's timezone
        const now = new Date();
        const dayIndex = parseInt(now.toLocaleString('en-US', { timeZone: tz, weekday: 'numeric' }), 10);
        // toLocaleString weekday: 'numeric' returns 1 (Sunday) through 7 (Saturday) in en-US
        // But this is unreliable — use a more explicit approach
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
const generateWeeklyReview = async (userId, timezone) => {
    const logger = getLogger();
    const tz = timezone || 'America/New_York';
    const today = getTodayStr(tz);

    try {
        // 1. Get user data and goals
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
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

        // 4. Compute this week's stats
        const thisWeekByDay = {};
        for (const date of thisWeekDates) {
            thisWeekByDay[date] = thisWeekLogs.filter(l => l.date === date);
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

        // 5. Compute previous week's stats
        const prevWeekByDay = {};
        for (const date of prevWeekDates) {
            prevWeekByDay[date] = prevWeekLogs.filter(l => l.date === date);
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

FORMAT YOUR RESPONSE WITH EXACTLY THESE 4 SECTIONS:

**Wins**
1-2 things that went well this week. Be specific with numbers from the data.

**Patterns**
1-2 observations about eating patterns (e.g., consistency, meal timing, protein distribution).

**Compared to last week**
1 specific comparison point using actual numbers. If no previous week data, note this is a baseline week.

WEEKLY FOCUS: [Write exactly ONE specific, measurable focus for next week. It should be actionable and based on the data. Examples: "Hit 100g+ protein on at least 5 days", "Log all 3 main meals every day", "Keep daily calories under 2200"]

RULES:
- No emojis
- Use the data — don't make up numbers
- Keep each section to 1-2 sentences
- The WEEKLY FOCUS line MUST start with exactly "WEEKLY FOCUS:" (this is parsed programmatically)
- Be encouraging but honest
- The focus must be specific and measurable, not vague`;

        // 7. Call Gemini
        const result = await genAI.models.generateContent({
            model: MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { temperature: 0.7, maxOutputTokens: 500 }
        });

        const reviewText = result.candidates?.[0]?.content?.parts?.find(p => p.text)?.text?.trim() || '';

        if (!reviewText) {
            throw new Error('Empty response from Gemini for weekly review');
        }

        // 8. Parse the weekly focus
        const focusMatch = reviewText.match(/WEEKLY FOCUS:\s*(.+)/i);
        const focusText = focusMatch ? focusMatch[1].trim() : null;

        // 9. Store the review as a chat message
        const chatHistoryRef = db.collection('users').doc(userId).collection('chatHistory');
        const reviewMessage = {
            role: 'assistant',
            content: reviewText,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            metadata: {
                type: 'weekly_review',
                weekStart: thisWeekStart,
                weekEnd: thisWeekEnd,
                model: MODEL,
            }
        };
        const msgDoc = await chatHistoryRef.add(reviewMessage);

        // 10. Store the focus and update lastWeeklyReview
        const userUpdate = {
            lastWeeklyReview: today,
        };
        if (focusText) {
            userUpdate.weeklyFocus = {
                label: focusText,
                setAt: admin.firestore.FieldValue.serverTimestamp(),
                reviewMessageId: msgDoc.id,
            };
        }
        await db.collection('users').doc(userId).update(userUpdate);

        logger.info({
            userId,
            messageId: msgDoc.id,
            daysTracked,
            daysOnTarget,
            hasFocus: !!focusText,
        }, 'Weekly review generated');

        return {
            message: reviewText,
            focus: focusText,
            messageId: msgDoc.id,
        };
    } catch (error) {
        logger.error({ err: error, userId }, 'Failed to generate weekly review');
        throw error;
    }
};

module.exports = { shouldTriggerReview, generateWeeklyReview };
