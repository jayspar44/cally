const { db } = require('../services/firebase');

/**
 * Get daily nutrition summary for a specific date
 */
/**
 * Get daily nutrition summary for a specific date
 */
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

        // Aggregate totals (New Schema: logs are items)
        const summary = logs.reduce((acc, log) => ({
            totalCalories: acc.totalCalories + (log.calories || 0), // Changed from totalCalories
            totalProtein: acc.totalProtein + (log.protein || 0),
            totalCarbs: acc.totalCarbs + (log.carbs || 0),
            totalFat: acc.totalFat + (log.fat || 0),
            mealCount: acc.mealCount // Count logic handled below in grouping
        }), { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, mealCount: 0 });

        // Group by meal for "Today's Meals" list
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

        // Convert map to array and format description
        const mealOrder = { 'breakfast': 1, 'lunch': 2, 'dinner': 3, 'snack': 4 };
        const meals = Object.values(mealsMap)
            .map(m => ({
                meal: m.meal,
                totalCalories: m.totalCalories,
                description: m.items.map(i => i.name).filter(n => n?.trim()).join(', '), // Filter empty names
                items: m.items
            }))
            .sort((a, b) => (mealOrder[a.meal] || 99) - (mealOrder[b.meal] || 99));

        summary.mealCount = meals.length;

        // Get user goals
        const userDoc = await db.collection('users').doc(userId).get();
        const settings = userDoc.exists ? userDoc.data().settings : {};

        const goals = {
            targetCalories: settings.targetCalories || 2000,
            targetProtein: settings.targetProtein || 50,
            targetCarbs: settings.targetCarbs || 250,
            targetFat: settings.targetFat || 65
        };

        // Calculate remaining
        const remaining = {
            calories: goals.targetCalories - summary.totalCalories,
            protein: goals.targetProtein - summary.totalProtein,
            carbs: goals.targetCarbs - summary.totalCarbs,
            fat: goals.targetFat - summary.totalFat
        };

        // Calculate percentages
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
            meals // Now grouped by meal type
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get daily summary');
        res.status(500).json({ error: 'Failed to get daily summary' });
    }
};

/**
 * Get weekly trends (last 7 days)
 */
const getWeeklyTrends = async (req, res) => {
    try {
        const userId = req.user.uid;

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 6); // Last 7 days including today

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');
        const snapshot = await foodLogsRef
            .where('date', '>=', startStr)
            .where('date', '<=', endStr)
            .get();

        const logs = snapshot.docs.map(doc => doc.data());

        // Group by date
        const byDate = {};
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            byDate[dateStr] = { calories: 0, protein: 0, carbs: 0, fat: 0, meals: new Set() };
        }

        logs.forEach(log => {
            if (byDate[log.date]) {
                byDate[log.date].calories += log.calories || 0; // Fixed: calories
                byDate[log.date].protein += log.protein || 0;
                byDate[log.date].carbs += log.carbs || 0;
                byDate[log.date].fat += log.fat || 0;
                byDate[log.date].meals.add(log.meal);
            }
        });

        // Convert to array sorted by date
        const days = Object.entries(byDate)
            .map(([date, data]) => ({
                date,
                ...data,
                meals: data.meals.size // Count unique meals (e.g. Breakfast, Lunch)
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Calculate averages
        const daysWithData = days.filter(d => d.meals > 0).length || 1;
        const totals = days.reduce((acc, d) => ({
            calories: acc.calories + d.calories,
            protein: acc.protein + d.protein,
            carbs: acc.carbs + d.carbs,
            fat: acc.fat + d.fat
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        const averages = {
            calories: Math.round(totals.calories / daysWithData),
            protein: Math.round(totals.protein / daysWithData),
            carbs: Math.round(totals.carbs / daysWithData),
            fat: Math.round(totals.fat / daysWithData)
        };

        res.json({
            startDate: startStr,
            endDate: endStr,
            days,
            totals,
            averages,
            daysTracked: daysWithData
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get weekly trends');
        res.status(500).json({ error: 'Failed to get weekly trends' });
    }
};

/**
 * Get monthly trends (last 30 days)
 */
const getMonthlyTrends = async (req, res) => {
    try {
        const userId = req.user.uid;

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 29); // Last 30 days including today

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');
        const snapshot = await foodLogsRef
            .where('date', '>=', startStr)
            .where('date', '<=', endStr)
            .get();

        const logs = snapshot.docs.map(doc => doc.data());

        // Group by week
        const weeks = [{}, {}, {}, {}, {}]; // Up to 5 weeks
        logs.forEach(log => {
            const logDate = new Date(log.date);
            const daysSinceStart = Math.floor((logDate - startDate) / (1000 * 60 * 60 * 24));
            const weekIndex = Math.min(4, Math.floor(daysSinceStart / 7));

            if (!weeks[weekIndex].calories) {
                weeks[weekIndex] = { calories: 0, protein: 0, carbs: 0, fat: 0, daysSet: new Set() };
            }
            weeks[weekIndex].calories += log.calories || 0; // Fixed: calories
            weeks[weekIndex].protein += log.protein || 0;
            weeks[weekIndex].carbs += log.carbs || 0;
            weeks[weekIndex].fat += log.fat || 0;
            weeks[weekIndex].daysSet.add(log.date);
        });

        // Calculate daily averages per week
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

        // Overall averages
        const daysWithData = logs.length > 0 ? new Set(logs.map(l => l.date)).size : 1;
        const totals = logs.reduce((acc, log) => ({
            calories: acc.calories + (log.calories || 0), // Fixed: calories
            protein: acc.protein + (log.protein || 0),
            carbs: acc.carbs + (log.carbs || 0),
            fat: acc.fat + (log.fat || 0)
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

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
