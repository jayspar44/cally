const { db } = require('../services/firebase');
const { toDateStr, parseLocalDate, getTodayStr } = require('../utils/dateUtils');
const { getGoalsForDate, snapshotGoals, getUserSettings } = require('../services/goalsService');

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
            calories: Math.min(100, (summary.totalCalories / goals.targetCalories) * 100),
            protein: Math.min(100, (summary.totalProtein / goals.targetProtein) * 100),
            carbs: Math.min(100, (summary.totalCarbs / goals.targetCarbs) * 100),
            fat: Math.min(100, (summary.totalFat / goals.targetFat) * 100)
        };

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

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 6);

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

        const settings = await getUserSettings(userId);
        const goals = await getGoalsForDate(userId, toDateStr(), settings);

        res.json({
            startDate: startStr,
            endDate: endStr,
            days,
            totals,
            averages,
            goals,
            daysTracked: daysWithData
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get weekly trends');
        res.status(500).json({ error: 'Failed to get weekly trends' });
    }
};

const getMonthlyTrends = async (req, res) => {
    try {
        const userId = req.user.uid;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 29);

        const startStr = toDateStr(startDate);
        const endStr = toDateStr(endDate);

        const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');
        const snapshot = await foodLogsRef
            .where('date', '>=', startStr)
            .where('date', '<=', endStr)
            .get();

        const logs = snapshot.docs.map(doc => doc.data());

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
                const days = w.daysSet ? w.daysSet.size : 0;
                return {
                    week: i + 1,
                    avgCalories: days > 0 ? Math.round(w.calories / days) : 0,
                    avgProtein: days > 0 ? Math.round(w.protein / days) : 0,
                    avgCarbs: days > 0 ? Math.round(w.carbs / days) : 0,
                    avgFat: days > 0 ? Math.round(w.fat / days) : 0,
                    daysTracked: days
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

        res.json({
            startDate: startStr,
            endDate: endStr,
            weeks: weeklyData,
            totals,
            averages,
            daysTracked: daysWithData
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get monthly trends');
        res.status(500).json({ error: 'Failed to get monthly trends' });
    }
};

module.exports = {
    getDailySummary,
    getWeeklyTrends,
    getMonthlyTrends
};
