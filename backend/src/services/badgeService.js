const { db } = require('./firebase');
const { getGoalsForDate, getUserSettings } = require('./goalsService');
const { parseLocalDate, toDateStr, getTodayStr } = require('../utils/dateUtils');
const { getLogger } = require('../logger');

const BADGE_DEFINITIONS = {
    // Consistency (6 badges)
    first_steps: {
        id: 'first_steps', name: 'First Steps', category: 'consistency',
        icon: '\u{1F463}', description: 'Log meals for 3 consecutive days',
        requirement: { type: 'streak', target: 3 }
    },
    week_warrior: {
        id: 'week_warrior', name: 'Week Warrior', category: 'consistency',
        icon: '\u{1F525}', tier: 'bronze', description: '7-day logging streak',
        requirement: { type: 'streak', target: 7 }
    },
    fortnight_force: {
        id: 'fortnight_force', name: 'Fortnight Force', category: 'consistency',
        icon: '\u{1F525}', tier: 'silver', description: '14-day logging streak',
        requirement: { type: 'streak', target: 14 }
    },
    monthly_master: {
        id: 'monthly_master', name: 'Monthly Master', category: 'consistency',
        icon: '\u{1F525}', tier: 'gold', description: '30-day logging streak',
        requirement: { type: 'streak', target: 30 }
    },
    century_club: {
        id: 'century_club', name: 'Century Club', category: 'consistency',
        icon: '\u{1F525}', tier: 'platinum', description: '100-day logging streak',
        requirement: { type: 'streak', target: 100 }
    },
    year_of_kalli: {
        id: 'year_of_kalli', name: 'Year of Kalli', category: 'consistency',
        icon: '\u{1F525}', tier: 'diamond', description: '365-day logging streak',
        requirement: { type: 'streak', target: 365 }
    },

    // Target Hitting (5 badges)
    goal_getter: {
        id: 'goal_getter', name: 'Goal Getter', category: 'target',
        icon: '\u{1F3AF}', description: 'Hit calorie target (within \u00B110%) for the first time',
        requirement: { type: 'calorie_on_target_once' }
    },
    bullseye_week: {
        id: 'bullseye_week', name: 'Bullseye Week', category: 'target',
        icon: '\u{1F3AF}\u{1F3AF}', description: 'Hit calorie target 7 consecutive days',
        requirement: { type: 'consecutive_calorie_target', target: 7 }
    },
    macro_master: {
        id: 'macro_master', name: 'Macro Master', category: 'target',
        icon: '\u2696\uFE0F', description: 'Hit all 3 macros within \u00B110% in a single day',
        requirement: { type: 'all_macros_on_target_once' }
    },
    balanced_week: {
        id: 'balanced_week', name: 'Balanced Week', category: 'target',
        icon: '\u2696\uFE0F\u2696\uFE0F', description: 'Hit all 3 macros within \u00B110% for 5+ days in a week',
        requirement: { type: 'balanced_week', target: 5 }
    },
    protein_machine: {
        id: 'protein_machine', name: 'Protein Machine', category: 'target',
        icon: '\u{1F4AA}', description: 'Hit protein goal for 14 consecutive days',
        requirement: { type: 'consecutive_protein_target', target: 14 }
    },

    // Logging Milestones (4 badges)
    first_bite: {
        id: 'first_bite', name: 'First Bite', category: 'milestone',
        icon: '\u{1F34E}', description: 'Log your first food item',
        requirement: { type: 'total_logs', target: 1 }
    },
    century_logger: {
        id: 'century_logger', name: 'Century Logger', category: 'milestone',
        icon: '\u{1F4DD}', description: 'Log 100 total food items',
        requirement: { type: 'total_logs', target: 100 }
    },
    five_hundred_club: {
        id: 'five_hundred_club', name: 'Five Hundred Club', category: 'milestone',
        icon: '\u{1F4DD}\u{1F4DD}', description: 'Log 500 total food items',
        requirement: { type: 'total_logs', target: 500 }
    },
    thousand_strong: {
        id: 'thousand_strong', name: 'Thousand Strong', category: 'milestone',
        icon: '\u{1F4DD}\u{1F4DD}\u{1F4DD}', description: 'Log 1,000 total food items',
        requirement: { type: 'total_logs', target: 1000 }
    },

    // Behavior (3 badges)
    full_day: {
        id: 'full_day', name: 'Full Day', category: 'behavior',
        icon: '\u{1F37D}\uFE0F', description: 'Log breakfast, lunch, AND dinner in a single day',
        requirement: { type: 'full_day_meals' }
    },
    photo_scout: {
        id: 'photo_scout', name: 'Photo Scout', category: 'behavior',
        icon: '\u{1F4F8}', description: 'Use photo recognition to log 5+ items',
        requirement: { type: 'photo_logs', target: 5 }
    },
    comeback_kid: {
        id: 'comeback_kid', name: 'Comeback Kid', category: 'behavior',
        icon: '\u{1F504}', description: 'Return and log after 7+ day gap',
        requirement: { type: 'comeback', gapDays: 7 }
    },

    // Nutrition Quality (2 badges)
    protein_power_day: {
        id: 'protein_power_day', name: 'Protein Power Day', category: 'quality',
        icon: '\u{1F3CB}\uFE0F', description: 'Hit 2x your daily protein target in a single day',
        requirement: { type: 'double_protein' }
    },
    under_budget: {
        id: 'under_budget', name: 'Under Budget', category: 'quality',
        icon: '\u{1F4B0}', description: 'Stay within \u00B15% of calorie target for 7 consecutive days',
        requirement: { type: 'consecutive_tight_calorie', target: 7 }
    }
};

/**
 * Compute the user's current streak (consecutive days with at least one log).
 * Grace period: if today has no logs and it's before 8 PM user-local-time,
 * start counting from yesterday.
 */
const computeStreak = (logDates, timezone) => {
    if (logDates.size === 0) return { current: 0, best: 0 };

    const todayStr = getTodayStr(timezone);
    const today = parseLocalDate(todayStr);

    // Check if we should apply grace period
    let startDate = today;
    if (!logDates.has(todayStr)) {
        // Check if it's before 8 PM in user's timezone
        const nowInTz = new Date().toLocaleString('en-US', { timeZone: timezone || 'America/New_York' });
        const hour = new Date(nowInTz).getHours();
        if (hour < 20) {
            startDate = parseLocalDate(todayStr);
            startDate.setDate(startDate.getDate() - 1);
        } else {
            // After 8 PM with no logs today = streak broken
            startDate = today;
        }
    }

    // Count current streak backwards
    let current = 0;
    const d = new Date(startDate);
    while (logDates.has(toDateStr(d))) {
        current++;
        d.setDate(d.getDate() - 1);
    }

    // Compute best streak from all dates
    const sortedDates = [...logDates].sort();
    let best = 0;
    let run = 1;
    for (let i = 1; i < sortedDates.length; i++) {
        const prev = parseLocalDate(sortedDates[i - 1]);
        const curr = parseLocalDate(sortedDates[i]);
        const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
            run++;
        } else {
            best = Math.max(best, run);
            run = 1;
        }
    }
    best = Math.max(best, run, current);

    return { current, best };
};

/**
 * Compute current target streak — consecutive days (walking backwards from
 * today, with the same grace period as computeStreak) where testFn returns true.
 * @param {Object} byDate - { [dateStr]: { calories, protein, carbs, fat, ... } }
 * @param {string[]} sortedDates - sorted array of date strings with logs
 * @param {string} timezone - user timezone
 * @param {function} testFn - (dayData) => boolean
 * @returns {number} streak count
 */
const computeCurrentTargetStreak = (byDate, sortedDates, timezone, testFn) => {
    if (sortedDates.length === 0) return 0;

    const todayStr = getTodayStr(timezone);
    const logDatesSet = new Set(sortedDates);

    // Determine start date (same grace period logic as computeStreak)
    let startStr = todayStr;
    if (!logDatesSet.has(todayStr)) {
        const nowInTz = new Date().toLocaleString('en-US', { timeZone: timezone || 'America/New_York' });
        const hour = new Date(nowInTz).getHours();
        if (hour < 20) {
            const yesterday = parseLocalDate(todayStr);
            yesterday.setDate(yesterday.getDate() - 1);
            startStr = toDateStr(yesterday);
        }
        // After 8 PM with no logs today — streak is 0 since today doesn't pass
    }

    // Walk backwards counting consecutive days where testFn passes
    let streak = 0;
    const d = parseLocalDate(startStr);
    while (true) {
        const ds = toDateStr(d);
        if (!logDatesSet.has(ds) || !byDate[ds] || !testFn(byDate[ds])) break;
        streak++;
        d.setDate(d.getDate() - 1);
    }

    return streak;
};

/**
 * Check which badges a user has newly earned after a food log action.
 * Returns array of newly earned badge IDs.
 */
const checkBadgeEligibility = async (userId) => {
    const logger = getLogger();
    try {
        const settings = await getUserSettings(userId);
        const timezone = settings.timezone || 'America/New_York';
        const todayStr = getTodayStr(timezone);
        const goals = await getGoalsForDate(userId, todayStr, settings);

        // Get all earned badges
        const badgesSnapshot = await db.collection('users').doc(userId)
            .collection('badges').get();
        const earnedBadgeIds = new Set(badgesSnapshot.docs.map(d => d.id));

        // Get all food logs (for the checks we need)
        const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');
        const allLogsSnapshot = await foodLogsRef.orderBy('date', 'desc').limit(5000).get();
        const allLogs = allLogsSnapshot.docs.map(d => d.data());

        if (allLogs.length === 0) return [];

        // Build helper data structures
        const logDates = new Set(allLogs.map(l => l.date));
        const byDate = {};
        allLogs.forEach(log => {
            if (!byDate[log.date]) byDate[log.date] = { calories: 0, protein: 0, carbs: 0, fat: 0, meals: new Set(), sources: [] };
            byDate[log.date].calories += log.calories || 0;
            byDate[log.date].protein += log.protein || 0;
            byDate[log.date].carbs += log.carbs || 0;
            byDate[log.date].fat += log.fat || 0;
            if (log.meal) byDate[log.date].meals.add(log.meal);
            if (log.source) byDate[log.date].sources.push(log.source);
        });

        const sortedDates = [...logDates].sort();
        const { current: currentStreak } = computeStreak(logDates, timezone);

        const newBadges = [];

        for (const [badgeId, badge] of Object.entries(BADGE_DEFINITIONS)) {
            if (earnedBadgeIds.has(badgeId)) continue;

            const req = badge.requirement;
            let earned = false;

            switch (req.type) {
                case 'streak':
                    earned = currentStreak >= req.target;
                    break;

                case 'total_logs':
                    earned = allLogs.length >= req.target;
                    break;

                case 'calorie_on_target_once': {
                    const target = goals.targetCalories;
                    earned = Object.values(byDate).some(d =>
                        Math.abs(d.calories - target) <= target * 0.1
                    );
                    break;
                }

                case 'consecutive_calorie_target': {
                    const target = goals.targetCalories;
                    let run = 0;
                    for (const dateStr of sortedDates) {
                        const d = byDate[dateStr];
                        if (Math.abs(d.calories - target) <= target * 0.1) {
                            // Check consecutive
                            if (run === 0 || isConsecutive(sortedDates[sortedDates.indexOf(dateStr) - 1], dateStr)) {
                                run++;
                            } else {
                                run = 1;
                            }
                            if (run >= req.target) { earned = true; break; }
                        } else {
                            run = 0;
                        }
                    }
                    break;
                }

                case 'all_macros_on_target_once': {
                    earned = Object.values(byDate).some(d =>
                        isWithinPct(d.protein, goals.targetProtein, 0.1) &&
                        isWithinPct(d.carbs, goals.targetCarbs, 0.1) &&
                        isWithinPct(d.fat, goals.targetFat, 0.1)
                    );
                    break;
                }

                case 'balanced_week': {
                    // Check any 7-day window for 5+ days all macros on target
                    for (let i = 0; i <= sortedDates.length - 5; i++) {
                        const windowStart = parseLocalDate(sortedDates[i]);
                        const windowEnd = new Date(windowStart);
                        windowEnd.setDate(windowEnd.getDate() + 6);
                        const windowEndStr = toDateStr(windowEnd);

                        const windowDates = sortedDates.filter(d => d >= sortedDates[i] && d <= windowEndStr);
                        const balancedDays = windowDates.filter(d => {
                            const day = byDate[d];
                            return isWithinPct(day.protein, goals.targetProtein, 0.1) &&
                                isWithinPct(day.carbs, goals.targetCarbs, 0.1) &&
                                isWithinPct(day.fat, goals.targetFat, 0.1);
                        }).length;

                        if (balancedDays >= req.target) { earned = true; break; }
                    }
                    break;
                }

                case 'consecutive_protein_target': {
                    let run = 0;
                    for (const dateStr of sortedDates) {
                        const d = byDate[dateStr];
                        if (isWithinPct(d.protein, goals.targetProtein, 0.1)) {
                            if (run === 0 || isConsecutive(sortedDates[sortedDates.indexOf(dateStr) - 1], dateStr)) {
                                run++;
                            } else {
                                run = 1;
                            }
                            if (run >= req.target) { earned = true; break; }
                        } else {
                            run = 0;
                        }
                    }
                    break;
                }

                case 'full_day_meals':
                    earned = Object.values(byDate).some(d =>
                        d.meals.has('breakfast') && d.meals.has('lunch') && d.meals.has('dinner')
                    );
                    break;

                case 'photo_logs': {
                    const photoCount = allLogs.filter(l => l.source === 'photo').length;
                    earned = photoCount >= req.target;
                    break;
                }

                case 'comeback': {
                    // Check for a gap of 7+ days followed by a new log
                    for (let i = 1; i < sortedDates.length; i++) {
                        const prev = parseLocalDate(sortedDates[i - 1]);
                        const curr = parseLocalDate(sortedDates[i]);
                        const gap = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
                        if (gap >= req.gapDays) { earned = true; break; }
                    }
                    break;
                }

                case 'double_protein':
                    earned = Object.values(byDate).some(d =>
                        d.protein >= (goals.targetProtein * 2)
                    );
                    break;

                case 'consecutive_tight_calorie': {
                    const target = goals.targetCalories;
                    let run = 0;
                    for (const dateStr of sortedDates) {
                        const d = byDate[dateStr];
                        if (Math.abs(d.calories - target) <= target * 0.05) {
                            if (run === 0 || isConsecutive(sortedDates[sortedDates.indexOf(dateStr) - 1], dateStr)) {
                                run++;
                            } else {
                                run = 1;
                            }
                            if (run >= req.target) { earned = true; break; }
                        } else {
                            run = 0;
                        }
                    }
                    break;
                }
            }

            if (earned) {
                newBadges.push(badge);
                await db.collection('users').doc(userId)
                    .collection('badges').doc(badgeId)
                    .set({ badgeId, earnedAt: new Date(), metadata: {} });
                logger.info({ action: 'badge.earned', userId, badgeId }, `Badge earned: ${badge.name}`);
            }
        }

        return newBadges;
    } catch (error) {
        logger.error({ err: error, userId }, 'Badge eligibility check failed');
        return [];
    }
};

/**
 * Get all badges for a user — earned + progress on in-progress ones.
 */
const getUserBadges = async (userId) => {
    const settings = await getUserSettings(userId);
    const timezone = settings.timezone || 'America/New_York';
    const todayStr = getTodayStr(timezone);
    const goals = await getGoalsForDate(userId, todayStr, settings);

    // Get earned badges
    const badgesSnapshot = await db.collection('users').doc(userId)
        .collection('badges').get();
    const earnedMap = {};
    badgesSnapshot.docs.forEach(d => {
        const data = d.data();
        earnedMap[d.id] = data.earnedAt?.toDate?.() || data.earnedAt;
    });

    // Get food logs for progress computation
    const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');
    const allLogsSnapshot = await foodLogsRef.orderBy('date', 'desc').limit(5000).get();
    const allLogs = allLogsSnapshot.docs.map(d => d.data());

    const logDates = new Set(allLogs.map(l => l.date));
    const byDate = {};
    allLogs.forEach(log => {
        if (!byDate[log.date]) byDate[log.date] = { calories: 0, protein: 0, carbs: 0, fat: 0, meals: new Set(), sources: [] };
        byDate[log.date].calories += log.calories || 0;
        byDate[log.date].protein += log.protein || 0;
        byDate[log.date].carbs += log.carbs || 0;
        byDate[log.date].fat += log.fat || 0;
        if (log.meal) byDate[log.date].meals.add(log.meal);
        if (log.source) byDate[log.date].sources.push(log.source);
    });

    const { current: currentStreak, best: bestStreak } = computeStreak(logDates, timezone);
    const sortedDates = [...logDates].sort();

    const calorieStreak = computeCurrentTargetStreak(byDate, sortedDates, timezone,
        d => Math.abs(d.calories - goals.targetCalories) <= goals.targetCalories * 0.1
    );
    const macroStreak = computeCurrentTargetStreak(byDate, sortedDates, timezone,
        d => isWithinPct(d.protein, goals.targetProtein, 0.1) &&
             isWithinPct(d.carbs, goals.targetCarbs, 0.1) &&
             isWithinPct(d.fat, goals.targetFat, 0.1)
    );

    const earned = [];
    const progress = [];

    for (const [badgeId, badge] of Object.entries(BADGE_DEFINITIONS)) {
        if (earnedMap[badgeId]) {
            earned.push({
                badgeId, name: badge.name, description: badge.description,
                icon: badge.icon, category: badge.category, tier: badge.tier || null,
                earnedAt: earnedMap[badgeId]
            });
        } else {
            const prog = computeProgress(badge, {
                allLogs, byDate, logDates, currentStreak, goals, sortedDates
            });
            if (prog) {
                progress.push({
                    badgeId, name: badge.name, description: badge.description,
                    icon: badge.icon, category: badge.category, tier: badge.tier || null,
                    current: prog.current, target: prog.target,
                    percentage: Math.min(100, Math.round((prog.current / prog.target) * 100))
                });
            }
        }
    }

    // Sort earned by date (most recent first), progress by percentage (closest to done first)
    earned.sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt));
    progress.sort((a, b) => b.percentage - a.percentage);

    return {
        earned,
        progress,
        stats: { currentStreak, bestStreak, calorieStreak, macroStreak }
    };
};

function computeProgress(badge, ctx) {
    const req = badge.requirement;
    switch (req.type) {
        case 'streak':
            return { current: ctx.currentStreak, target: req.target };
        case 'total_logs':
            return { current: ctx.allLogs.length, target: req.target };
        case 'consecutive_calorie_target': {
            const target = ctx.goals.targetCalories;
            let run = 0, best = 0;
            for (const dateStr of ctx.sortedDates) {
                const d = ctx.byDate[dateStr];
                if (Math.abs(d.calories - target) <= target * 0.1) {
                    if (run === 0 || isConsecutive(ctx.sortedDates[ctx.sortedDates.indexOf(dateStr) - 1], dateStr)) {
                        run++;
                    } else { run = 1; }
                    best = Math.max(best, run);
                } else { run = 0; }
            }
            return { current: best, target: req.target };
        }
        case 'consecutive_protein_target': {
            let run = 0, best = 0;
            for (const dateStr of ctx.sortedDates) {
                const d = ctx.byDate[dateStr];
                if (isWithinPct(d.protein, ctx.goals.targetProtein, 0.1)) {
                    if (run === 0 || isConsecutive(ctx.sortedDates[ctx.sortedDates.indexOf(dateStr) - 1], dateStr)) {
                        run++;
                    } else { run = 1; }
                    best = Math.max(best, run);
                } else { run = 0; }
            }
            return { current: best, target: req.target };
        }
        case 'photo_logs': {
            const count = ctx.allLogs.filter(l => l.source === 'photo').length;
            return { current: count, target: req.target };
        }
        case 'consecutive_tight_calorie': {
            const target = ctx.goals.targetCalories;
            let run = 0, best = 0;
            for (const dateStr of ctx.sortedDates) {
                const d = ctx.byDate[dateStr];
                if (Math.abs(d.calories - target) <= target * 0.05) {
                    if (run === 0 || isConsecutive(ctx.sortedDates[ctx.sortedDates.indexOf(dateStr) - 1], dateStr)) {
                        run++;
                    } else { run = 1; }
                    best = Math.max(best, run);
                } else { run = 0; }
            }
            return { current: best, target: req.target };
        }
        default:
            return null;
    }
}

function isWithinPct(actual, target, pct) {
    if (!target || target === 0) return false;
    return Math.abs(actual - target) <= target * pct;
}

function isConsecutive(prevDateStr, currDateStr) {
    if (!prevDateStr) return false;
    const prev = parseLocalDate(prevDateStr);
    const curr = parseLocalDate(currDateStr);
    return Math.round((curr - prev) / (1000 * 60 * 60 * 24)) === 1;
}

module.exports = {
    BADGE_DEFINITIONS,
    checkBadgeEligibility,
    getUserBadges,
    computeStreak,
    computeCurrentTargetStreak
};
