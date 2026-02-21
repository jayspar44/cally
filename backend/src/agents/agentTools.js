const { db } = require('../services/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const { searchFoods, quickLookup } = require('../services/nutritionService');
const { getGoalsForDate, getUserSettings, snapshotGoals } = require('../services/goalsService');
const { calculateRecommendedTargets } = require('../services/nutritionCalculator');
const { checkBadgeEligibility } = require('../services/badgeService');
const { getLogger } = require('../logger');
const { getTodayStr } = require('../utils/dateUtils');

const VALID_MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const ALLOWED_UPDATE_KEYS = ['name', 'quantity', 'unit', 'calories', 'protein', 'carbs', 'fat', 'meal', 'date'];

const toolDeclarations = [
    {
        name: 'logFood',
        description: 'Log a NEW food entry. IMPORTANT: Pass food data in the "items" array parameter — do NOT use "foods", "foodItems", or flat arguments. Example: items: [{ name: "Scrambled eggs", quantity: 2, unit: "large", calories: 182, protein: 12, carbs: 2, fat: 14 }]. NEVER use this to correct or adjust an existing entry — use updateFoodLog instead.',
        parameters: {
            type: 'object',
            properties: {
                date: {
                    type: 'string',
                    description: 'Date in YYYY-MM-DD format. Use today\'s date unless user specifies otherwise.'
                },
                meal: {
                    type: 'string',
                    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
                    description: 'Which meal this food belongs to'
                },
                description: {
                    type: 'string',
                    description: 'Brief description of what was eaten, e.g., "Turkey sandwich with chips"'
                },
                originalMessage: {
                    type: 'string',
                    description: 'The exact text from the user\'s message that describes this food entry, e.g., "I had 2 eggs"'
                },
                items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Food item name' },
                            quantity: { type: 'number', description: 'Quantity consumed' },
                            unit: { type: 'string', description: 'Unit of measurement (e.g., "cup", "oz", "piece")' },
                            calories: { type: 'number', description: 'Estimated calories' },
                            protein: { type: 'number', description: 'Protein in grams' },
                            carbs: { type: 'number', description: 'Carbohydrates in grams' },
                            fat: { type: 'number', description: 'Fat in grams' },
                            confidence: { type: 'number', description: 'Your confidence in this estimate, 0-1' }
                        },
                        required: ['name', 'quantity', 'unit', 'calories', 'protein', 'carbs', 'fat']
                    },
                    description: 'REQUIRED. Array of food item objects. Each object must have: name, quantity, unit, calories, protein, carbs, fat. Do NOT pass food data as flat arguments or under other keys like "foods" or "foodItems" — use this "items" array.'
                },
                nutritionSource: {
                    type: 'string',
                    enum: ['ai_estimate', 'usda', 'common_foods', 'user_input', 'nutrition_label'],
                    description: 'Source of the nutrition data. Use "ai_estimate" if you estimated it, "usda" if you used lookupNutrition and found it in USDA, "common_foods" if you used lookupNutrition and found it there, "user_input" if the user explicitly provided macros, "nutrition_label" if from an image/label.'
                }
            },
            required: ['date', 'meal', 'items', 'nutritionSource']
        }
    },
    {
        name: 'lookupNutrition',
        description: 'Look up nutrition information for a food item. Use this when you need accurate nutrition data for a specific food.',
        parameters: {
            type: 'object',
            properties: {
                foodName: {
                    type: 'string',
                    description: 'Name of the food to look up'
                }
            },
            required: ['foodName']
        }
    },
    {
        name: 'updateFoodLog',
        description: 'Update an existing food log entry. Use when user wants to correct or modify a previously logged meal.',
        parameters: {
            type: 'object',
            properties: {
                logId: {
                    type: 'string',
                    description: 'ID of the food log to update'
                },
                updates: {
                    type: 'object',
                    description: 'Fields to update',
                    properties: {
                        name: { type: 'string', description: 'Food item name' },
                        quantity: { type: 'number', description: 'Quantity' },
                        unit: { type: 'string', description: 'Unit' },
                        calories: { type: 'number', description: 'Calories' },
                        protein: { type: 'number', description: 'Protein (g)' },
                        carbs: { type: 'number', description: 'Carbs (g)' },
                        fat: { type: 'number', description: 'Fat (g)' },
                        meal: {
                            type: 'string',
                            enum: ['breakfast', 'lunch', 'dinner', 'snack']
                        }
                    }
                }
            },
            required: ['logId', 'updates']
        }
    },
    {
        name: 'getDailySummary',
        description: 'Get the user\'s nutrition summary for a specific day. Use this to check current progress.',
        parameters: {
            type: 'object',
            properties: {
                date: {
                    type: 'string',
                    description: 'Date in YYYY-MM-DD format'
                }
            },
            required: ['date']
        }
    },
    {
        name: 'searchFoodLogs',
        description: 'Search for past food logs to get their IDs. Use this BEFORE updateFoodLog when the user wants to change a previous entry.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search term (e.g., "coffee", "breakfast", "sandwich")'
                },
                date: {
                    type: 'string',
                    description: 'Date to search in YYYY-MM-DD format (defaults to today)'
                }
            },
            required: ['query']
        }
    },
    {
        name: 'getUserGoals',
        description: 'Get the user\'s nutrition goals (daily calorie and macro targets).',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'deleteFoodLog',
        description: 'Permanently delete a food log entry. IMPORTANT: You MUST confirm with the user before calling this tool. Always use searchFoodLogs first to find the correct logId, show the user what you plan to delete, and only proceed after explicit confirmation.',
        parameters: {
            type: 'object',
            properties: {
                logId: {
                    type: 'string',
                    description: 'ID of the food log entry to delete. Must be obtained from searchFoodLogs.'
                }
            },
            required: ['logId']
        }
    },
    {
        name: 'updateUserProfile',
        description: 'Save or update user profile including name, body measurements, and fitness goals. When recalculateTargets is true, calculates personalized nutrition targets using the Mifflin-St Jeor equation and saves them. IMPORTANT: Only call this AFTER the user has confirmed the proposed values — never call it speculatively.',
        parameters: {
            type: 'object',
            properties: {
                firstName: { type: 'string', description: "User's preferred name" },
                biometrics: {
                    type: 'object',
                    description: 'Body metrics and goals',
                    properties: {
                        weight: { type: 'number' },
                        weightUnit: { type: 'string', enum: ['lbs', 'kg'] },
                        height: { type: 'number', description: 'Total inches or cm' },
                        heightUnit: { type: 'string', enum: ['in', 'cm'] },
                        age: { type: 'number' },
                        gender: { type: 'string', enum: ['male', 'female', 'other'] },
                        goalType: { type: 'string', enum: ['lose_weight', 'maintain', 'gain_muscle'] },
                        activityLevel: { type: 'string', enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active'] }
                    }
                },
                targetOverrides: {
                    type: 'object',
                    description: 'Optional user overrides for calculated targets',
                    properties: {
                        targetCalories: { type: 'number' },
                        targetProtein: { type: 'number' },
                        targetCarbs: { type: 'number' },
                        targetFat: { type: 'number' }
                    }
                },
                recalculateTargets: { type: 'boolean', description: 'Calculate recommended nutrition targets from biometrics. Default true.' }
            },
            required: ['biometrics']
        }
    }
];

const executeTool = async (toolName, args, userId, userTimezone, idempotencyKey, options = {}) => {
    try {
        switch (toolName) {
            case 'logFood':
                return await logFood(args, userId, userTimezone, idempotencyKey, options);
            case 'lookupNutrition':
                return await lookupNutrition(args);
            case 'updateFoodLog':
                return await updateFoodLog(args, userId);
            case 'getDailySummary':
                return await getDailySummaryTool(args, userId, userTimezone);
            case 'getUserGoals':
                return await getUserGoals(userId);
            case 'searchFoodLogs':
                return await searchFoodLogs(args, userId, userTimezone);
            case 'deleteFoodLog':
                return await deleteFoodLog(args, userId);
            case 'updateUserProfile':
                return await updateUserProfile(args, userId, userTimezone);
            default:
                return { success: false, error: `Unknown tool: ${toolName}` };
        }
    } catch (error) {
        getLogger().error({ err: error, toolName }, 'Tool execution failed');
        return { success: false, error: error.message };
    }
};

const logFood = async (args, userId, userTimezone, idempotencyKey, options = {}) => {
    let { date, meal, items, originalMessage, nutritionSource } = args;

    if (!meal && args.mealType) meal = args.mealType;

    if (meal) {
        meal = meal.toLowerCase();
        if (!VALID_MEALS.includes(meal)) {
            getLogger().warn({ meal }, 'Invalid meal type received from AI, defaulting to snack');
            meal = 'snack';
        }
    } else {
        meal = 'snack';
    }

    if (!date) {
        date = getTodayStr(userTimezone);
    }

    // Normalize: accept foods, foodItems, or flat args in addition to items
    if ((!items || items.length === 0) && (args.foods || args.foodItems)) {
        const altArray = args.foods || args.foodItems;
        if (Array.isArray(altArray) && altArray.length > 0) {
            getLogger().info({ key: args.foods ? 'foods' : 'foodItems' },
                'Detected alternative array key, normalizing to items');
            items = altArray;
        }
    }

    // Flat-arg fallback: accept both foodName and name
    if ((!items || items.length === 0) && (args.foodName || args.name)) {
        getLogger().info('Detected flat food arguments, converting to items array');
        items = [{
            name: args.foodName || args.name,
            quantity: args.quantity || 1,
            unit: args.unit || 'serving',
            calories: args.calories || 0,
            protein: args.protein || 0,
            carbs: args.carbs || 0,
            fat: args.fat || 0,
            confidence: args.confidence || 0.8
        }];
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        getLogger().warn({ args: Object.keys(args) }, 'logFood called without valid items array');
        return {
            success: false,
            error: 'No valid items provided. Call logFood with an "items" array containing objects with name, quantity, unit, calories, protein, carbs, fat fields.'
        };
    }

    // Idempotency check: if this key was already used, return early
    if (idempotencyKey) {
        const existingSnapshot = await db.collection('users').doc(userId)
            .collection('foodLogs')
            .where('idempotencyKey', '==', idempotencyKey)
            .limit(1)
            .get();

        if (!existingSnapshot.empty) {
            getLogger().info({ idempotencyKey }, 'Duplicate logFood call detected, returning cached result');
            const existingDocs = existingSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            const totals = existingDocs.reduce((acc, doc) => ({
                calories: acc.calories + (doc.calories || 0),
                protein: acc.protein + (doc.protein || 0),
                carbs: acc.carbs + (doc.carbs || 0),
                fat: acc.fat + (doc.fat || 0)
            }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

            return {
                success: true,
                deduplicated: true,
                message: `Already logged ${existingDocs.length} item(s) for this request.`,
                data: {
                    date: existingDocs[0].date,
                    meal: existingDocs[0].meal,
                    items: existingDocs.map(item => ({
                        id: item.id, name: item.name, quantity: item.quantity,
                        unit: item.unit, calories: item.calories, protein: item.protein,
                        carbs: item.carbs, fat: item.fat, meal: item.meal, date: item.date
                    })),
                    count: existingDocs.length,
                    totalCalories: Math.round(totals.calories),
                    totalProtein: Math.round(totals.protein),
                    totalCarbs: Math.round(totals.carbs),
                    totalFat: Math.round(totals.fat)
                }
            };
        }
    }

    // Time-window duplicate check: same date + meal + name within 60s
    // Filter out duplicate items instead of returning early for the entire batch
    const newItems = [];
    const skippedItems = [];
    for (const item of items) {
        const recentSnapshot = await db.collection('users').doc(userId)
            .collection('foodLogs')
            .where('date', '==', date)
            .where('meal', '==', meal)
            .where('name', '==', item.name)
            .limit(5)
            .get();

        let mostRecentTime = 0;
        for (const doc of recentSnapshot.docs) {
            const ts = doc.data().createdAt?.toDate?.()?.getTime() || 0;
            if (ts > mostRecentTime) { mostRecentTime = ts; }
        }

        if (mostRecentTime > 0 && (Date.now() - mostRecentTime) < 60000) {
            getLogger().warn({
                item: item.name, date, meal, secondsAgo: Math.round((Date.now() - mostRecentTime) / 1000)
            }, 'Possible duplicate food log within 60s window — skipping item');
            skippedItems.push(item);
        } else {
            newItems.push(item);
        }
    }

    if (newItems.length === 0 && skippedItems.length > 0) {
        const names = skippedItems.map(i => i.name).join(', ');
        return {
            success: true,
            deduplicated: true,
            message: `${names} already logged for ${meal} moments ago. Skipping to avoid duplicate.`,
            data: { date, meal, items: [], count: 0,
                totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
        };
    }

    // Continue with non-duplicate items only
    items = newItems;

    const batch = db.batch();
    const createdIds = [];

    for (const item of items) {
        const docRef = db.collection('users').doc(userId).collection('foodLogs').doc();

        const foodLogItem = {
            date,
            meal,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            calories: item.calories || 0,
            protein: item.protein || 0,
            carbs: item.carbs || 0,
            fat: item.fat || 0,
            originalMessage: originalMessage || '',
            source: options.source || 'chat',
            nutritionSource: nutritionSource || 'ai_estimate',
            corrected: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            ...(idempotencyKey ? { idempotencyKey } : {})
        };

        batch.set(docRef, foodLogItem);
        createdIds.push({ id: docRef.id, ...foodLogItem });
    }

    const totals = items.reduce((acc, item) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein || 0),
        carbs: acc.carbs + (item.carbs || 0),
        fat: acc.fat + (item.fat || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    await batch.commit();

    getLogger().info({
        action: 'tool.logFood',
        date,
        meal,
        logIds: createdIds.map(i => i.id),
        items: items.map(i => ({ name: i.name, calories: i.calories })),
        totalCalories: Math.round(totals.calories)
    }, 'Food logged via AI tool');

    // Check for newly earned badges (non-blocking)
    let newBadges = [];
    try {
        newBadges = await checkBadgeEligibility(userId);
    } catch (err) {
        getLogger().warn({ err }, 'Badge check failed after logFood (non-critical)');
    }

    const result = {
        success: true,
        message: `Logged ${createdIds.length} item(s) for ${meal}: ${Math.round(totals.calories)} cal, ${Math.round(totals.protein)}g protein, ${Math.round(totals.carbs)}g carbs, ${Math.round(totals.fat)}g fat.`,
        data: {
            date,
            meal,
            items: createdIds.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                calories: item.calories,
                protein: item.protein,
                carbs: item.carbs,
                fat: item.fat,
                meal: item.meal,
                date: item.date
            })),
            count: createdIds.length,
            totalCalories: Math.round(totals.calories),
            totalProtein: Math.round(totals.protein),
            totalCarbs: Math.round(totals.carbs),
            totalFat: Math.round(totals.fat)
        }
    };

    if (newBadges.length > 0) {
        result.newBadges = newBadges.map(b => ({ badgeId: b.id, name: b.name, icon: b.icon }));
        result.message += ` New badge${newBadges.length > 1 ? 's' : ''} earned: ${newBadges.map(b => `${b.icon} ${b.name}`).join(', ')}!`;
    }

    return result;
};

const lookupNutrition = async (args) => {
    const { foodName } = args;

    const quickResult = quickLookup(foodName);
    if (quickResult) {
        return {
            success: true,
            source: 'common_foods',
            data: quickResult
        };
    }

    const usdaResults = await searchFoods(foodName, 3);
    if (usdaResults.length > 0) {
        return {
            success: true,
            source: 'usda',
            data: usdaResults[0],
            alternatives: usdaResults.slice(1)
        };
    }

    return {
        success: false,
        error: `No nutrition data found for "${foodName}". Please estimate based on your knowledge.`
    };
};

const searchFoodLogs = async (args, userId, userTimezone) => {
    let { query, date } = args;

    if (!date) {
        date = getTodayStr(userTimezone);
    }

    try {
        const snapshot = await db.collection('users').doc(userId)
            .collection('foodLogs')
            .where('date', '==', date)
            .get();

        if (snapshot.empty) {
            return { success: true, count: 0, matches: [], message: `No food logs found for ${date}` };
        }

        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (!query) {
            return {
                success: true,
                data: {
                    count: logs.length,
                    date,
                    matches: logs.map(m => ({
                        id: m.id,
                        name: m.name,
                        meal: m.meal,
                        quantity: m.quantity,
                        unit: m.unit,
                        calories: m.calories,
                        time: m.createdAt?.toDate?.()?.toLocaleTimeString() || 'N/A'
                    }))
                }
            };
        }

        const lowerQuery = query.toLowerCase();

        const matches = logs.filter(log => {
            const nameMatch = log.name?.toLowerCase().includes(lowerQuery);
            const msgMatch = log.originalMessage?.toLowerCase().includes(lowerQuery);
            const mealMatch = log.meal?.toLowerCase().includes(lowerQuery);
            return nameMatch || msgMatch || mealMatch;
        });

        return {
            success: true,
            data: {
                count: matches.length,
                date,
                matches: matches.map(m => ({
                    id: m.id,
                    name: m.name,
                    meal: m.meal,
                    quantity: m.quantity,
                    unit: m.unit,
                    calories: m.calories,
                    time: m.createdAt?.toDate?.()?.toLocaleTimeString() || 'N/A'
                }))
            }
        };
    } catch (error) {
        getLogger().error({ err: error }, 'Error searching food logs');
        return { success: false, error: 'Failed to search logs' };
    }
};

const updateFoodLog = async (args, userId) => {
    const { logId, updates } = args;

    if (!logId) {
        return { success: false, error: 'logId is required. Use searchFoodLogs to find the correct ID first.' };
    }

    const docRef = db.collection('users').doc(userId).collection('foodLogs').doc(logId);
    const doc = await docRef.get();

    if (!doc.exists) {
        return { success: false, error: 'Food log item not found. Please use searchFoodLogs to find the correct ID first.' };
    }

    // AI may pass fields directly in args or nested under updates
    const source = updates && typeof updates === 'object' ? updates : args;

    const cleanUpdates = {};

    if (source.items && Array.isArray(source.items) && source.items.length > 0) {
        const item = source.items[0];
        Object.keys(item).forEach(k => {
            if (ALLOWED_UPDATE_KEYS.includes(k)) cleanUpdates[k] = item[k];
        });
    } else {
        Object.keys(source).forEach(k => {
            if (ALLOWED_UPDATE_KEYS.includes(k)) cleanUpdates[k] = source[k];
        });
    }

    if (Object.keys(cleanUpdates).length === 0) {
        return { success: false, error: 'No valid updates provided' };
    }

    cleanUpdates.updatedAt = FieldValue.serverTimestamp();
    cleanUpdates.corrected = true;

    getLogger().info({
        action: 'tool.updateFoodLog',
        logId,
        fields: Object.keys(cleanUpdates).filter(k => k !== 'updatedAt' && k !== 'corrected'),
        updates: cleanUpdates
    }, 'Updating food log via AI tool');

    await docRef.update(cleanUpdates);

    return {
        success: true,
        data: { id: logId, updated: true, fields: Object.keys(cleanUpdates) }
    };
};

const deleteFoodLog = async (args, userId) => {
    const { logId } = args;

    if (!logId) {
        return { success: false, error: 'logId is required. Use searchFoodLogs to find the correct ID first.' };
    }

    const docRef = db.collection('users').doc(userId).collection('foodLogs').doc(logId);
    const doc = await docRef.get();

    if (!doc.exists) {
        return { success: false, error: 'Food log entry not found. Use searchFoodLogs to verify the ID.' };
    }

    const data = doc.data();

    await docRef.delete();

    getLogger().info({
        action: 'tool.deleteFoodLog',
        logId,
        deletedItem: { name: data.name, meal: data.meal, calories: data.calories, date: data.date }
    }, 'Food log deleted via AI tool');

    // Re-check badges after deletion (a badge could theoretically be affected, but we only add, never revoke)
    let newBadges = [];
    try {
        newBadges = await checkBadgeEligibility(userId);
    } catch (err) {
        getLogger().warn({ err }, 'Badge check failed after deleteFoodLog (non-critical)');
    }

    const result = {
        success: true,
        data: { id: logId, deleted: true, name: data.name, meal: data.meal, calories: data.calories }
    };

    if (newBadges.length > 0) {
        result.newBadges = newBadges.map(b => ({ badgeId: b.id, name: b.name, icon: b.icon }));
    }

    return result;
};

const getDailySummaryTool = async (args, userId, userTimezone) => {
    let { date } = args;

    if (!date) {
        date = getTodayStr(userTimezone);
    }

    const snapshot = await db.collection('users').doc(userId)
        .collection('foodLogs')
        .where('date', '==', date)
        .get();

    const logs = snapshot.docs.map(doc => doc.data());

    const summary = logs.reduce((acc, log) => ({
        calories: acc.calories + (log.calories || 0),
        protein: acc.protein + (log.protein || 0),
        carbs: acc.carbs + (log.carbs || 0),
        fat: acc.fat + (log.fat || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const mealsMap = logs.reduce((acc, log) => {
        const mealName = log.meal || 'snack';
        if (!acc[mealName]) {
            acc[mealName] = {
                meal: mealName,
                description: [], // We'll accumulate item names
                totalCalories: 0,
                items: []
            };
        }
        acc[mealName].description.push(`${log.quantity} ${log.unit} ${log.name}`);
        acc[mealName].totalCalories += (log.calories || 0);
        acc[mealName].items.push(log);
        return acc;
    }, {});

    const meals = Object.values(mealsMap).map(m => ({
        ...m,
        description: m.description.join(', ')
    }));

    return {
        success: true,
        data: {
            date,
            ...summary,
            meals: meals.map(m => ({
                ...m,
                items: m.items.map(i => ({
                    ...i,
                    createdAt: i.createdAt?.toDate?.()?.toISOString() || i.createdAt,
                    updatedAt: i.updatedAt?.toDate?.()?.toISOString() || i.updatedAt
                }))
            }))
        }
    };
};

const getUserGoals = async (userId) => {
    const settings = await getUserSettings(userId);
    const today = getTodayStr(settings.timezone);
    const goals = await getGoalsForDate(userId, today, settings);
    return { success: true, data: goals };
};

const updateUserProfile = async (args, userId, userTimezone) => {
    const { firstName, biometrics, targetOverrides, recalculateTargets = true } = args;

    if (!biometrics || !biometrics.weight) {
        return { success: false, error: 'Weight is required in biometrics.' };
    }

    const normalizedBio = {
        weight: biometrics.weight,
        weightUnit: biometrics.weightUnit || 'lbs',
        height: biometrics.height || null,
        heightUnit: biometrics.heightUnit || 'in',
        age: biometrics.age || null,
        gender: biometrics.gender || null,
        goalType: biometrics.goalType || 'maintain',
        activityLevel: biometrics.activityLevel || 'sedentary',
    };

    const updateData = { biometrics: normalizedBio };
    if (firstName) updateData.firstName = firstName;

    let targets = null;
    let calculationDetails = null;

    if (recalculateTargets) {
        const result = calculateRecommendedTargets(normalizedBio);
        if (result.error) {
            return { success: false, error: result.error };
        }

        targets = {
            targetCalories: result.targetCalories,
            targetProtein: result.targetProtein,
            targetCarbs: result.targetCarbs,
            targetFat: result.targetFat,
        };
        calculationDetails = result.calculationDetails;

        // Apply user overrides on top of calculated values
        if (targetOverrides) {
            if (targetOverrides.targetCalories) targets.targetCalories = targetOverrides.targetCalories;
            if (targetOverrides.targetProtein) targets.targetProtein = targetOverrides.targetProtein;
            if (targetOverrides.targetCarbs) targets.targetCarbs = targetOverrides.targetCarbs;
            if (targetOverrides.targetFat) targets.targetFat = targetOverrides.targetFat;
        }

        // Preserve existing settings (timezone, etc.) and merge targets
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const existingSettings = userDoc.exists ? (userDoc.data().settings || {}) : {};
        updateData.settings = { ...existingSettings, ...targets };

        // Snapshot goals for today
        const todayStr = getTodayStr(userTimezone);
        await snapshotGoals(userId, todayStr, updateData.settings);
    }

    await db.collection('users').doc(userId).set(updateData, { merge: true });

    getLogger().info({
        action: 'tool.updateUserProfile',
        userId,
        firstName: firstName || undefined,
        biometrics: normalizedBio,
        targets,
    }, 'User profile updated via AI tool');

    return {
        success: true,
        message: 'Profile updated successfully.',
        data: {
            firstName: firstName || undefined,
            biometrics: normalizedBio,
            targets,
            calculationDetails,
        }
    };
};

module.exports = {
    toolDeclarations,
    executeTool
};
