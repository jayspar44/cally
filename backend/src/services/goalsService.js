const { db } = require('./firebase');

const DEFAULT_GOALS = {
    targetCalories: 2000,
    targetProtein: 50,
    targetCarbs: 250,
    targetFat: 65
};

const GOAL_KEYS = Object.keys(DEFAULT_GOALS);

/**
 * Get user's nutrition goals for a given date.
 * Priority: dailyGoals snapshot → user settings → defaults.
 */
const getGoalsForDate = async (userId, date, settings = {}) => {
    const dailyGoalDoc = await db.collection('users').doc(userId)
        .collection('dailyGoals').doc(date).get();

    const source = dailyGoalDoc.exists ? dailyGoalDoc.data() : settings;

    return Object.fromEntries(
        GOAL_KEYS.map(key => [key, source[key] || settings[key] || DEFAULT_GOALS[key]])
    );
};

/**
 * Snapshot current targets to dailyGoals for a given date.
 */
const snapshotGoals = async (userId, date, settings) => {
    const snapshot = {};
    for (const key of GOAL_KEYS) {
        if (settings[key] !== undefined) snapshot[key] = settings[key];
    }
    if (Object.keys(snapshot).length > 0) {
        await db.collection('users').doc(userId)
            .collection('dailyGoals').doc(date)
            .set(snapshot, { merge: true });
    }
};

/**
 * Get user settings from their profile doc, with timezone.
 */
const getUserSettings = async (userId) => {
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.exists ? (userDoc.data().settings || {}) : {};
};

module.exports = { DEFAULT_GOALS, GOAL_KEYS, getGoalsForDate, snapshotGoals, getUserSettings };
