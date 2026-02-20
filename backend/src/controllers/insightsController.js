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
        const prevDaysWithData = prevDates.size || 1;
        const prevTotals = aggregateMacros(prevLogs);
        const prevAvgCalories = Math.round(prevTotals.calories / prevDaysWithData);
        const calorieDelta = averages.calories - prevAvgCalories;

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

        req.log.info({ action: 'insights.getMonthlyTrends' }, 'Fetching monthly trends');

        const settings = await getUserSettings(userId);
        const todayStr = getTodayStr(settings.timezone);
        const startDate = parseLocalDate(todayStr);
        startDate.setDate(startDate.getDate() - 29);

        const startStr = toDateStr(startDate);
        const endStr = todayStr;

        const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');
        const snapshot = await foodLogsRef
            .where('date', '>=', startStr)
            .where('date', '<=', endStr)
            .get();

        const logs = snapshot.docs.map(doc => doc.data());

        // Build daily granularity for trend chart
        const endDate = parseLocalDate(todayStr);
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

        req.log.info({ action: 'insights.getQuarterlyTrends' }, 'Fetching quarterly trends');

        const settings = await getUserSettings(userId);
        const todayStr = getTodayStr(settings.timezone);
        const startDate = parseLocalDate(todayStr);
        startDate.setDate(startDate.getDate() - 89);

        const startStr = toDateStr(startDate);
        const endStr = todayStr;

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
                weekEnd: toDateStr(bucketEnd > parseLocalDate(todayStr) ? parseLocalDate(todayStr) : bucketEnd),
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
        const { week: weekParam } = req.query;

        req.log.info({ action: 'insights.getAISummary', week: weekParam }, 'Fetching AI summary');

        const settings = await getUserSettings(userId);
        const todayStr = getTodayStr(settings.timezone);

        // Determine week start
        let weekStart;
        if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
            weekStart = weekParam;
        } else {
            const wsDate = parseLocalDate(todayStr);
            wsDate.setDate(wsDate.getDate() - 6);
            weekStart = toDateStr(wsDate);
        }

        const weekEnd = parseLocalDate(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekEndStr = toDateStr(weekEnd);

        // Check cache
        const cacheRef = db.collection('users').doc(userId)
            .collection('weeklyInsights').doc(weekStart);
        const cacheDoc = await cacheRef.get();

        if (cacheDoc.exists) {
            return res.json({ insight: cacheDoc.data().insight, weekStart, cached: true });
        }

        // Fetch week's data
        const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');
        const snapshot = await foodLogsRef
            .where('date', '>=', weekStart)
            .where('date', '<=', weekEndStr)
            .get();

        const logs = snapshot.docs.map(doc => doc.data());

        if (logs.length === 0) {
            return res.json({ insight: null, weekStart, noData: true });
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
        const avgCalories = Math.round(totalCals / daysTracked);
        const avgProtein = Math.round(totalProtein / daysTracked);

        const prompt = `You are Kalli, a friendly AI nutrition coach. Write a 2-3 sentence personalized weekly insight for the user based on this data. Be warm, specific, and actionable. Use Kalli's conversational voice (contractions, casual tone, no filler affirmations).

Week: ${weekStart} to ${weekEndStr}
Days tracked: ${daysTracked}/7
Average daily calories: ${avgCalories} (goal: ${goals.targetCalories})
Average daily protein: ${avgProtein}g (goal: ${goals.targetProtein}g)
Total items logged: ${logs.length}
Top foods: ${[...new Set(logs.map(l => l.name))].slice(0, 8).join(', ')}

Keep it to 2-3 sentences max. Focus on one positive observation and one actionable suggestion.`;

        const result = await genAI.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { maxOutputTokens: 256, temperature: 0.8 }
        });

        const insight = result.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || '';

        // Cache the result
        await cacheRef.set({
            insight,
            weekStart,
            weekEnd: weekEndStr,
            generatedAt: new Date(),
            stats: { daysTracked, avgCalories, avgProtein }
        });

        res.json({ insight, weekStart, cached: false });
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
