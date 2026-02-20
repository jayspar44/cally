const { db } = require('../services/firebase');
const { toDateStr, parseLocalDate, getTodayStr } = require('../utils/dateUtils');
const { getGoalsForDate, snapshotGoals, getUserSettings } = require('../services/goalsService');
const { GoogleGenAI } = require('@google/genai');

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const MEAL_ORDER = { 'breakfast': 1, 'lunch': 2, 'dinner': 3, 'snack': 4 };

const aggregateMacros = (logs) => logs.reduce((acc, log) => ({
    calories: acc.calories + (log.calories || 0),
    protein: acc.protein + (log.protein || 0),
    carbs: acc.carbs + (log.carbs || 0),
    fat: acc.fat + (log.fat || 0)
}), { calories: 0, protein: 0, carbs: 0, fat: 0 });

const getDailySummary = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { date } = req.params;

        req.log.info({ action: 'insights.getDailySummary', date }, 'Fetching daily summary');

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) required' });
        }

        const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');
        const snapshot = await foodLogsRef.where('date', '==', date).get();

        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const macros = aggregateMacros(logs);
        const summary = {
            totalCalories: macros.calories,
            totalProtein: macros.protein,
            totalCarbs: macros.carbs,
            totalFat: macros.fat,
            mealCount: 0
        };

        const mealsMap = {};
        logs.forEach(log => {
            const mealType = log.meal;
            if (!mealsMap[mealType]) {
                mealsMap[mealType] = {
                    meal: mealType,
                    totalCalories: 0,
                    items: []
                };
            }
            mealsMap[mealType].totalCalories += (log.calories || 0);
            mealsMap[mealType].items.push({
                name: log.name,
                calories: log.calories || 0,
                protein: log.protein || 0,
                carbs: log.carbs || 0,
                fat: log.fat || 0,
                quantity: log.quantity,
                unit: log.unit
            });
        });

        const meals = Object.values(mealsMap)
            .map(m => ({
                meal: m.meal,
                totalCalories: m.totalCalories,
                description: m.items.map(i => i.name).filter(n => n?.trim()).join(', '),
                items: m.items
            }))
            .sort((a, b) => (MEAL_ORDER[a.meal] || 99) - (MEAL_ORDER[b.meal] || 99));

        summary.mealCount = meals.length;

        const settings = await getUserSettings(userId);
        const goals = await getGoalsForDate(userId, date, settings);

        // Lock in today's goals on first access
        const today = getTodayStr(settings.timezone);
        if (date === today) {
            await snapshotGoals(userId, today, settings);
        }

        const remaining = {
            calories: goals.targetCalories - summary.totalCalories,
            protein: goals.targetProtein - summary.totalProtein,
            carbs: goals.targetCarbs - summary.totalCarbs,
            fat: goals.targetFat - summary.totalFat
        };

        const progress = {
            calories: goals.targetCalories > 0 ? (summary.totalCalories / goals.targetCalories) * 100 : 0,
            protein: goals.targetProtein > 0 ? (summary.totalProtein / goals.targetProtein) * 100 : 0,
            carbs: goals.targetCarbs > 0 ? (summary.totalCarbs / goals.targetCarbs) * 100 : 0,
            fat: goals.targetFat > 0 ? (summary.totalFat / goals.targetFat) * 100 : 0
        };

        req.log.info({
            action: 'insights.getDailySummary',
            date,
            totalCalories: summary.totalCalories,
            mealCount: summary.mealCount
        }, 'Daily summary fetched');

        res.json({
            date,
            summary,
            goals,
            remaining,
            progress,
            meals
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get daily summary');
        res.status(500).json({ error: 'Failed to get daily summary' });
    }
};

const getWeeklyTrends = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { weekStart: weekStartParam } = req.query;

        req.log.info({ action: 'insights.getWeeklyTrends', weekStart: weekStartParam }, 'Fetching weekly trends');

        const settings = await getUserSettings(userId);
        const todayStr = getTodayStr(settings.timezone);

        // If weekStart is provided, use that week; otherwise use current week (last 7 days ending today)
        let startDate, endDate;
        if (weekStartParam && /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
            startDate = parseLocalDate(weekStartParam);
            endDate = parseLocalDate(weekStartParam);
            endDate.setDate(endDate.getDate() + 6);
        } else {
            endDate = parseLocalDate(todayStr);
            startDate = parseLocalDate(todayStr);
            startDate.setDate(startDate.getDate() - 6);
        }

        const startStr = toDateStr(startDate);
        const endStr = toDateStr(endDate);

        const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');
        const snapshot = await foodLogsRef
            .where('date', '>=', startStr)
            .where('date', '<=', endStr)
            .get();

        const logs = snapshot.docs.map(doc => doc.data());

        const byDate = {};
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = toDateStr(d);
            byDate[dateStr] = { calories: 0, protein: 0, carbs: 0, fat: 0, meals: new Set() };
        }

        logs.forEach(log => {
            if (byDate[log.date]) {
                byDate[log.date].calories += log.calories || 0;
                byDate[log.date].protein += log.protein || 0;
                byDate[log.date].carbs += log.carbs || 0;
                byDate[log.date].fat += log.fat || 0;
                byDate[log.date].meals.add(log.meal);
            }
        });

        const days = Object.entries(byDate)
            .map(([date, data]) => ({
                date,
                ...data,
                meals: data.meals.size
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const daysWithData = days.filter(d => d.meals > 0).length || 1;
        const totals = aggregateMacros(days);

        const averages = {
            calories: Math.round(totals.calories / daysWithData),
            protein: Math.round(totals.protein / daysWithData),
            carbs: Math.round(totals.carbs / daysWithData),
            fat: Math.round(totals.fat / daysWithData)
        };

        const goals = await getGoalsForDate(userId, todayStr, settings);

        // Compute daysOnTarget (within 10% of calorie goal)
        const calorieTarget = goals.targetCalories;
        const daysOnTarget = days.filter(d =>
            d.meals > 0 && Math.abs(d.calories - calorieTarget) <= calorieTarget * 0.1
        ).length;

        // Compute streak (consecutive days with data, ending at today or most recent tracked day)
        let streak = 0;
        const sortedDatesDesc = [...days].reverse();
        for (const day of sortedDatesDesc) {
            if (day.meals > 0) {
                streak++;
            } else {
                break;
            }
        }

        // Compute one-liner insights
        const daysWithFood = days.filter(d => d.meals > 0);
        let bestDay = null, worstDay = null;
        if (daysWithFood.length > 0) {
            bestDay = daysWithFood.reduce((best, d) =>
                Math.abs(d.calories - calorieTarget) < Math.abs(best.calories - calorieTarget) ? d : best
            );
            worstDay = daysWithFood.reduce((worst, d) =>
                Math.abs(d.calories - calorieTarget) > Math.abs(worst.calories - calorieTarget) ? d : worst
            );
        }

        // Previous week comparison
        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - 7);
        const prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        const prevStartStr = toDateStr(prevStartDate);
        const prevEndStr = toDateStr(prevEndDate);

        const prevSnapshot = await foodLogsRef
            .where('date', '>=', prevStartStr)
            .where('date', '<=', prevEndStr)
            .get();

        const prevLogs = prevSnapshot.docs.map(doc => doc.data());
        const prevDates = new Set(prevLogs.map(l => l.date));
        const prevDaysWithData = prevDates.size;
        const prevTotals = aggregateMacros(prevLogs);
        const prevAvgCalories = prevDaysWithData > 0
            ? Math.round(prevTotals.calories / prevDaysWithData)
            : null;
        const calorieDelta = prevAvgCalories != null
            ? averages.calories - prevAvgCalories
            : null;

        req.log.info({
            action: 'insights.getWeeklyTrends',
            daysTracked: daysWithData,
            avgCalories: averages.calories
        }, 'Weekly trends fetched');

        res.json({
            startDate: startStr,
            endDate: endStr,
            days,
            totals,
            averages,
            goals,
            daysTracked: daysWithData,
            daysOnTarget,
            streak,
            calorieDelta,
            prevAvgCalories,
            bestDay: bestDay ? { date: bestDay.date, calories: Math.round(bestDay.calories) } : null,
            worstDay: worstDay ? { date: worstDay.date, calories: Math.round(worstDay.calories) } : null,
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get weekly trends');
        res.status(500).json({ error: 'Failed to get weekly trends' });
    }
};

const getMonthlyTrends = async (req, res) => {
    try {
        const userId = req.user.uid;

        const { monthStart: monthStartParam } = req.query;
        req.log.info({ action: 'insights.getMonthlyTrends', monthStart: monthStartParam }, 'Fetching monthly trends');

        const settings = await getUserSettings(userId);
        const todayStr = getTodayStr(settings.timezone);
        const todayDate = parseLocalDate(todayStr);

        let startDate, endDate;
        if (monthStartParam && /^\d{4}-\d{2}-\d{2}$/.test(monthStartParam)) {
            startDate = parseLocalDate(monthStartParam);
            endDate = parseLocalDate(monthStartParam);
            endDate.setDate(endDate.getDate() + 29);
            if (endDate > todayDate) endDate = new Date(todayDate);
        } else {
            endDate = new Date(todayDate);
            startDate = parseLocalDate(todayStr);
            startDate.setDate(startDate.getDate() - 29);
        }

        const startStr = toDateStr(startDate);
        const endStr = toDateStr(endDate);

        const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');
        const snapshot = await foodLogsRef
            .where('date', '>=', startStr)
            .where('date', '<=', endStr)
            .get();

        const logs = snapshot.docs.map(doc => doc.data());

        // Build daily granularity for trend chart
        const byDate = {};
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = toDateStr(d);
            byDate[dateStr] = { calories: 0, protein: 0, carbs: 0, fat: 0, tracked: false };
        }

        logs.forEach(log => {
            if (byDate[log.date]) {
                byDate[log.date].calories += log.calories || 0;
                byDate[log.date].protein += log.protein || 0;
                byDate[log.date].carbs += log.carbs || 0;
                byDate[log.date].fat += log.fat || 0;
                byDate[log.date].tracked = true;
            }
        });

        const days = Object.entries(byDate)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Also compute weekly buckets for backward compat
        const weeks = [{}, {}, {}, {}, {}];
        logs.forEach(log => {
            const logDate = parseLocalDate(log.date);
            const daysSinceStart = Math.floor((logDate - startDate) / (1000 * 60 * 60 * 24));
            const weekIndex = Math.min(4, Math.floor(daysSinceStart / 7));

            if (!weeks[weekIndex].calories) {
                weeks[weekIndex] = { calories: 0, protein: 0, carbs: 0, fat: 0, daysSet: new Set() };
            }
            weeks[weekIndex].calories += log.calories || 0;
            weeks[weekIndex].protein += log.protein || 0;
            weeks[weekIndex].carbs += log.carbs || 0;
            weeks[weekIndex].fat += log.fat || 0;
            weeks[weekIndex].daysSet.add(log.date);
        });

        const weeklyData = weeks
            .map((w, i) => {
                const dayCount = w.daysSet ? w.daysSet.size : 0;
                return {
                    week: i + 1,
                    avgCalories: dayCount > 0 ? Math.round(w.calories / dayCount) : 0,
                    avgProtein: dayCount > 0 ? Math.round(w.protein / dayCount) : 0,
                    avgCarbs: dayCount > 0 ? Math.round(w.carbs / dayCount) : 0,
                    avgFat: dayCount > 0 ? Math.round(w.fat / dayCount) : 0,
                    daysTracked: dayCount
                };
            })
            .filter(w => w.daysTracked > 0);

        const daysWithData = logs.length > 0 ? new Set(logs.map(l => l.date)).size : 1;
        const totals = aggregateMacros(logs);

        const averages = {
            calories: Math.round(totals.calories / daysWithData),
            protein: Math.round(totals.protein / daysWithData),
            carbs: Math.round(totals.carbs / daysWithData),
            fat: Math.round(totals.fat / daysWithData)
        };

        const goals = await getGoalsForDate(userId, todayStr, settings);

        req.log.info({
            action: 'insights.getMonthlyTrends',
            daysTracked: daysWithData,
            avgCalories: averages.calories
        }, 'Monthly trends fetched');

        res.json({
            startDate: startStr,
            endDate: endStr,
            days,
            weeks: weeklyData,
            totals,
            averages,
            goals,
            daysTracked: daysWithData
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get monthly trends');
        res.status(500).json({ error: 'Failed to get monthly trends' });
    }
};

const getQuarterlyTrends = async (req, res) => {
    try {
        const userId = req.user.uid;

        const { quarterStart: quarterStartParam } = req.query;
        req.log.info({ action: 'insights.getQuarterlyTrends', quarterStart: quarterStartParam }, 'Fetching quarterly trends');

        const settings = await getUserSettings(userId);
        const todayStr = getTodayStr(settings.timezone);
        const todayDate = parseLocalDate(todayStr);

        let startDate, endDate;
        if (quarterStartParam && /^\d{4}-\d{2}-\d{2}$/.test(quarterStartParam)) {
            startDate = parseLocalDate(quarterStartParam);
            endDate = parseLocalDate(quarterStartParam);
            endDate.setDate(endDate.getDate() + 89);
            if (endDate > todayDate) endDate = new Date(todayDate);
        } else {
            endDate = new Date(todayDate);
            startDate = parseLocalDate(todayStr);
            startDate.setDate(startDate.getDate() - 89);
        }

        const startStr = toDateStr(startDate);
        const endStr = toDateStr(endDate);

        const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');
        const snapshot = await foodLogsRef
            .where('date', '>=', startStr)
            .where('date', '<=', endStr)
            .get();

        const logs = snapshot.docs.map(doc => doc.data());

        // Group into ~13 weekly buckets
        const buckets = [];
        for (let i = 0; i < 13; i++) {
            const bucketStart = new Date(startDate);
            bucketStart.setDate(bucketStart.getDate() + (i * 7));
            const bucketEnd = new Date(bucketStart);
            bucketEnd.setDate(bucketEnd.getDate() + 6);

            buckets.push({
                weekStart: toDateStr(bucketStart),
                weekEnd: toDateStr(bucketEnd > endDate ? endDate : bucketEnd),
                calories: 0, protein: 0, carbs: 0, fat: 0,
                daysTracked: new Set()
            });
        }

        logs.forEach(log => {
            const logDate = parseLocalDate(log.date);
            const daysSinceStart = Math.floor((logDate - startDate) / (1000 * 60 * 60 * 24));
            const bucketIndex = Math.min(12, Math.floor(daysSinceStart / 7));

            buckets[bucketIndex].calories += log.calories || 0;
            buckets[bucketIndex].protein += log.protein || 0;
            buckets[bucketIndex].carbs += log.carbs || 0;
            buckets[bucketIndex].fat += log.fat || 0;
            buckets[bucketIndex].daysTracked.add(log.date);
        });

        const weeks = buckets.map(b => {
            const days = b.daysTracked.size;
            return {
                weekStart: b.weekStart,
                weekEnd: b.weekEnd,
                avgCalories: days > 0 ? Math.round(b.calories / days) : 0,
                avgProtein: days > 0 ? Math.round(b.protein / days) : 0,
                avgCarbs: days > 0 ? Math.round(b.carbs / days) : 0,
                avgFat: days > 0 ? Math.round(b.fat / days) : 0,
                daysTracked: days
            };
        }).filter(w => w.daysTracked > 0);

        const goals = await getGoalsForDate(userId, todayStr, settings);

        res.json({ startDate: startStr, endDate: endStr, weeks, goals });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get quarterly trends');
        res.status(500).json({ error: 'Failed to get quarterly trends' });
    }
};

const getAISummary = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { week: weekParam, monthStart: monthStartParam, quarterStart: quarterStartParam, range: rangeParam } = req.query;
        const range = ['1W', '1M', '3M'].includes(rangeParam) ? rangeParam : '1W';

        req.log.info({ action: 'insights.getAISummary', week: weekParam, monthStart: monthStartParam, quarterStart: quarterStartParam, range }, 'Fetching AI summary');

        const settings = await getUserSettings(userId);
        const todayStr = getTodayStr(settings.timezone);

        // Determine date range based on range param
        let startStr, endStr, periodIdentifier, totalDaysInPeriod;

        if (range === '1W') {
            if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
                const ws = parseLocalDate(weekParam);
                const we = parseLocalDate(weekParam);
                we.setDate(we.getDate() + 6);
                startStr = toDateStr(ws);
                endStr = toDateStr(we);
            } else {
                const wsDate = parseLocalDate(todayStr);
                wsDate.setDate(wsDate.getDate() - 6);
                startStr = toDateStr(wsDate);
                endStr = todayStr;
            }
            periodIdentifier = startStr;
            totalDaysInPeriod = 7;
        } else if (range === '1M') {
            if (monthStartParam && /^\d{4}-\d{2}-\d{2}$/.test(monthStartParam)) {
                const ms = parseLocalDate(monthStartParam);
                const me = parseLocalDate(monthStartParam);
                me.setDate(me.getDate() + 29);
                const td = parseLocalDate(todayStr);
                startStr = toDateStr(ms);
                endStr = toDateStr(me > td ? td : me);
            } else {
                const msDate = parseLocalDate(todayStr);
                msDate.setDate(msDate.getDate() - 29);
                startStr = toDateStr(msDate);
                endStr = todayStr;
            }
            periodIdentifier = startStr;
            totalDaysInPeriod = 30;
        } else {
            if (quarterStartParam && /^\d{4}-\d{2}-\d{2}$/.test(quarterStartParam)) {
                const qs = parseLocalDate(quarterStartParam);
                const qe = parseLocalDate(quarterStartParam);
                qe.setDate(qe.getDate() + 89);
                const td = parseLocalDate(todayStr);
                startStr = toDateStr(qs);
                endStr = toDateStr(qe > td ? td : qe);
            } else {
                const qsDate = parseLocalDate(todayStr);
                qsDate.setDate(qsDate.getDate() - 89);
                startStr = toDateStr(qsDate);
                endStr = todayStr;
            }
            periodIdentifier = startStr;
            totalDaysInPeriod = 90;
        }

        // Fetch food logs first (needed for cache fingerprint + generation)
        const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');
        const snapshot = await foodLogsRef
            .where('date', '>=', startStr)
            .where('date', '<=', endStr)
            .get();

        const logs = snapshot.docs.map(doc => doc.data());

        if (logs.length === 0) {
            return res.json({ insight: null, range, periodIdentifier, noData: true });
        }

        // Data fingerprint: count + total calories — invalidates cache on add/delete/edit
        const totalCalsForHash = Math.round(logs.reduce((s, l) => s + (l.calories || 0), 0));
        const dataFingerprint = `${logs.length}_${totalCalsForHash}`;

        // Cache key: range + period identifier
        const cacheKey = `${range}_${periodIdentifier}`;
        const cacheRef = db.collection('users').doc(userId)
            .collection('weeklyInsights').doc(cacheKey);
        const cacheDoc = await cacheRef.get();

        const refresh = req.query.refresh === 'true';
        if (!refresh && cacheDoc.exists) {
            const cachedData = cacheDoc.data();
            if (cachedData.dataFingerprint === dataFingerprint) {
                return res.json({ insight: cachedData.insight, range, periodIdentifier, cached: true });
            }
            req.log.info({ cachedFingerprint: cachedData.dataFingerprint, currentFingerprint: dataFingerprint }, 'AI summary cache invalidated — food log data changed');
        }

        const goals = await getGoalsForDate(userId, todayStr, settings);

        // Compute stats for Gemini
        const byDate = {};
        logs.forEach(log => {
            if (!byDate[log.date]) byDate[log.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
            byDate[log.date].calories += log.calories || 0;
            byDate[log.date].protein += log.protein || 0;
            byDate[log.date].carbs += log.carbs || 0;
            byDate[log.date].fat += log.fat || 0;
        });

        const daysTracked = Object.keys(byDate).length;
        const totalCals = Object.values(byDate).reduce((s, d) => s + d.calories, 0);
        const totalProtein = Object.values(byDate).reduce((s, d) => s + d.protein, 0);
        const totalCarbs = Object.values(byDate).reduce((s, d) => s + d.carbs, 0);
        const totalFat = Object.values(byDate).reduce((s, d) => s + d.fat, 0);
        const avgCalories = Math.round(totalCals / daysTracked);
        const avgProtein = Math.round(totalProtein / daysTracked);
        const avgCarbs = Math.round(totalCarbs / daysTracked);
        const avgFat = Math.round(totalFat / daysTracked);

        // Build per-day summary for weekly prompt
        const dailyBreakdown = Object.keys(byDate).sort().map(date => {
            const dayName = parseLocalDate(date).toLocaleDateString('en-US', { weekday: 'short' });
            const dayFoods = logs.filter(l => l.date === date).map(l => l.name);
            const uniqueFoods = [...new Set(dayFoods)].slice(0, 4).join(', ');
            return `${dayName} ${date}: ${Math.round(byDate[date].calories)} cal — ${uniqueFoods}`;
        }).join('\n');

        const RANGE_PROMPTS = {
            '1W': `You are Kalli, a friendly AI nutrition coach. Write a 2-3 sentence personalized weekly insight. Focus on ACUTE adjustments. Reference specific days by name (e.g. 'Tuesday's pizza') — NEVER say 'yesterday' or 'today' since the user may read this days later. Be warm, specific, and actionable. Use contractions and casual tone, no filler affirmations.

Today: ${todayStr}
Period: ${startStr} to ${endStr} (this week)
Days tracked: ${daysTracked}/${totalDaysInPeriod}
Avg daily calories: ${avgCalories} (goal: ${goals.targetCalories})
Avg daily protein: ${avgProtein}g (goal: ${goals.targetProtein}g)
Avg daily carbs: ${avgCarbs}g (goal: ${goals.targetCarbs}g)
Avg daily fat: ${avgFat}g (goal: ${goals.targetFat}g)
Total items logged: ${logs.length}
Top foods: ${[...new Set(logs.map(l => l.name))].slice(0, 8).join(', ')}

Daily breakdown:
${dailyBreakdown}

Keep it to 2-3 sentences max. Focus on one positive observation and one actionable suggestion.`,

            '1M': (() => {
                const sortedDates = Object.keys(byDate).sort();
                const firstLogDate = sortedDates[0] || startStr;
                const lastLogDate = sortedDates[sortedDates.length - 1] || endStr;
                return `You are Kalli, a friendly AI nutrition coach. Write a 2-3 sentence personalized monthly insight. Focus on WEEKLY PATTERNS — weekday vs weekend consistency, recurring gaps, building habits. Be warm, specific, and actionable. Use contractions and casual tone, no filler affirmations. If the first log date is well after the period start, the user started tracking partway through — evaluate consistency only from their first log date forward. Do NOT call tracking 'sporadic' or suggest logging more if they've been consistent since starting.

Today: ${todayStr}
Period: ${startStr} to ${endStr} (last 30 days)
First log date in period: ${firstLogDate}
Last log date in period: ${lastLogDate}
Days tracked: ${daysTracked}/${totalDaysInPeriod}
Avg daily calories: ${avgCalories} (goal: ${goals.targetCalories})
Avg daily protein: ${avgProtein}g (goal: ${goals.targetProtein}g)
Avg daily carbs: ${avgCarbs}g (goal: ${goals.targetCarbs}g)
Avg daily fat: ${avgFat}g (goal: ${goals.targetFat}g)
Total items logged: ${logs.length}
Top foods: ${[...new Set(logs.map(l => l.name))].slice(0, 8).join(', ')}

Keep it to 2-3 sentences max. Focus on pattern-level observations.`;
            })(),

            '3M': (() => {
                const sortedDates = Object.keys(byDate).sort();
                const firstLogDate = sortedDates[0] || startStr;
                const lastLogDate = sortedDates[sortedDates.length - 1] || endStr;
                return `You are Kalli, a friendly AI nutrition coach. Write a 2-3 sentence personalized quarterly insight. Focus on LONG-TERM TRAJECTORY — progress over time, trends in the right direction, big-picture wins. Be warm, encouraging, and forward-looking. Use contractions and casual tone, no filler affirmations. If the first log date is well after the period start, the user started tracking partway through — evaluate consistency only from their first log date forward. Do NOT call tracking 'sporadic' or suggest logging more if they've been consistent since starting.

Today: ${todayStr}
Period: ${startStr} to ${endStr} (last 3 months)
First log date in period: ${firstLogDate}
Last log date in period: ${lastLogDate}
Days tracked: ${daysTracked}/${totalDaysInPeriod}
Avg daily calories: ${avgCalories} (goal: ${goals.targetCalories})
Avg daily protein: ${avgProtein}g (goal: ${goals.targetProtein}g)
Avg daily carbs: ${avgCarbs}g (goal: ${goals.targetCarbs}g)
Avg daily fat: ${avgFat}g (goal: ${goals.targetFat}g)
Total items logged: ${logs.length}
Top foods: ${[...new Set(logs.map(l => l.name))].slice(0, 8).join(', ')}

Keep it to 2-3 sentences max. Focus on progress trajectory and long-term wins.`;
            })()
        };

        const prompt = RANGE_PROMPTS[range];

        const result = await genAI.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { temperature: 0.8 }
        });

        const insight = result.candidates?.[0]?.content?.parts?.find(p => p.text)?.text?.trim() || '';

        // Cache the result with data fingerprint for invalidation
        await cacheRef.set({
            insight,
            range,
            periodIdentifier,
            dataFingerprint,
            startDate: startStr,
            endDate: endStr,
            generatedAt: new Date(),
            stats: { daysTracked, avgCalories, avgProtein }
        });

        res.json({ insight, range, periodIdentifier, cached: false });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get AI summary');
        res.status(500).json({ error: 'Failed to generate insight' });
    }
};

module.exports = {
    getDailySummary,
    getWeeklyTrends,
    getMonthlyTrends,
    getQuarterlyTrends,
    getAISummary
};
