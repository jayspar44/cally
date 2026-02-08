const { db } = require('../services/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const { searchFoods, quickLookup } = require('../services/nutritionService');
const logger = require('../logger');

/**
 * Tool declarations for Gemini function calling
 */
const toolDeclarations = [
    {
        name: 'logFood',
        description: 'Log a food entry to the user\'s food log. Use this when the user tells you what they ate and you have identified the food and quantities.',
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
                    description: 'Array of individual food items with nutrition info'
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
    }
];

/**
 * Execute a tool by name with given arguments
 */
const executeTool = async (toolName, args, userId, userTimezone) => {
    try {
        switch (toolName) {
            case 'logFood':
                return await logFood(args, userId, userTimezone);
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
            default:
                return { success: false, error: `Unknown tool: ${toolName}` };
        }
    } catch (error) {
        logger.error({ err: error, toolName }, 'Tool execution failed');
        return { success: false, error: error.message };
    }
};

/**
 * Log food to Firestore
 */
const logFood = async (args, userId, userTimezone) => {
    let { date, meal, description, items, originalMessage, nutritionSource } = args;

    // Compatibility layer for malformed AI arguments (Model sometimes sends flat fields instead of specific schema)
    if (!meal && args.mealType) meal = args.mealType;

    // Normalize meal to lowercase and valid enum
    if (meal) {
        meal = meal.toLowerCase();
        if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(meal)) {
            // Default to snack if invalid, or try to infer? 
            // Better to default to snack to avoid crash
            logger.warn({ meal }, 'Invalid meal type received from AI, defaulting to snack');
            meal = 'snack';
        }
    } else {
        // Fallback if strictly missing
        meal = 'snack';
    }

    // Default to user's local today if date not provided
    if (!date) {
        if (userTimezone) {
            // Get YYYY-MM-DD in user's timezone
            date = new Date().toLocaleDateString('en-CA', { timeZone: userTimezone });
        } else {
            date = new Date().toISOString().split('T')[0];
        }
    }

    const batch = db.batch();
    const createdIds = [];

    // Check if AI sent flat item details instead of items array
    if ((!items || items.length === 0) && args.foodName) {
        logger.info('Detected flat food arguments, converting to items array');
        items = [{
            name: args.foodName,
            quantity: args.quantity || 1,
            unit: args.unit || 'serving',
            calories: args.calories || 0,
            protein: args.protein || 0,
            carbs: args.carbs || 0,
            fat: args.fat || 0,
            confidence: args.confidence || 0.8
        }];
    }

    // Safety check for items
    if (!items || !Array.isArray(items)) {
        logger.warn({ args }, 'logFood called without valid items array');
        items = [];
    }

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
            source: 'chat',
            nutritionSource: nutritionSource || 'ai_estimate', // distinct from 'source' which tracks how the log was created
            corrected: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        };

        batch.set(docRef, foodLogItem);
        createdIds.push({ id: docRef.id, ...foodLogItem });
    }

    // Calculate totals for the response
    const totals = items.reduce((acc, item) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein || 0),
        carbs: acc.carbs + (item.carbs || 0),
        fat: acc.fat + (item.fat || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    await batch.commit();

    return {
        success: true,
        data: {
            // Return summary of what was logged
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
};

/**
 * Look up nutrition from USDA or common foods database
 */
const lookupNutrition = async (args) => {
    const { foodName } = args;

    // Try quick lookup first
    const quickResult = quickLookup(foodName);
    if (quickResult) {
        return {
            success: true,
            source: 'common_foods',
            data: quickResult
        };
    }

    // Fall back to USDA API
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

/**
 * Search food logs
 */
const searchFoodLogs = async (args, userId, userTimezone) => {
    let { query, date } = args;

    if (!date) {
        if (userTimezone) {
            date = new Date().toLocaleDateString('en-CA', { timeZone: userTimezone });
        } else {
            date = new Date().toISOString().split('T')[0];
        }
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
        const lowerQuery = query.toLowerCase();

        // Simple client-side fuzzy match
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
        logger.error({ err: error }, 'Error searching food logs');
        return { success: false, error: 'Failed to search logs' };
    }
};

/**
 * Update an existing food log
 */
const updateFoodLog = async (args, userId) => {
    const { logId, updates } = args;

    const docRef = db.collection('users').doc(userId).collection('foodLogs').doc(logId);
    const doc = await docRef.get();

    if (!doc.exists) {
        return { success: false, error: 'Food log item not found. Please use searchFoodLogs to find the correct ID first.' };
    }

    // Flatten updates? If Gemini sends `updates: { items: [...] }` that's bad.
    // We need to assume `updates` contains { calories: 123, name: '...' } etc.
    // I will sanitize keys.
    const allowedKeys = ['name', 'quantity', 'unit', 'calories', 'protein', 'carbs', 'fat', 'meal', 'date'];
    const cleanUpdates = {};

    // If updates is nested (e.g. from old schema), try to extract
    if (updates.items && Array.isArray(updates.items) && updates.items.length > 0) {
        // Assume they want to update THIS item with the first item in the list
        const item = updates.items[0];
        Object.keys(item).forEach(k => {
            if (allowedKeys.includes(k)) cleanUpdates[k] = item[k];
        });
    } else {
        Object.keys(updates).forEach(k => {
            if (allowedKeys.includes(k)) cleanUpdates[k] = updates[k];
        });
    }

    if (Object.keys(cleanUpdates).length === 0) {
        return { success: false, error: 'No valid updates provided' };
    }

    cleanUpdates.updatedAt = FieldValue.serverTimestamp();
    cleanUpdates.corrected = true;

    await docRef.update(cleanUpdates);

    return {
        success: true,
        data: { id: logId, updated: true, fields: Object.keys(cleanUpdates) }
    };
};

/**
 * Get daily summary for a date
 */
const getDailySummaryTool = async (args, userId, userTimezone) => {
    let { date } = args;

    if (!date) {
        if (userTimezone) {
            date = new Date().toLocaleDateString('en-CA', { timeZone: userTimezone });
        } else {
            date = new Date().toISOString().split('T')[0];
        }
    }

    const snapshot = await db.collection('users').doc(userId)
        .collection('foodLogs')
        .where('date', '==', date)
        .get();

    const logs = snapshot.docs.map(doc => doc.data());

    // Aggregate totals
    const summary = logs.reduce((acc, log) => ({
        calories: acc.calories + (log.calories || 0),
        protein: acc.protein + (log.protein || 0),
        carbs: acc.carbs + (log.carbs || 0),
        fat: acc.fat + (log.fat || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    // Group items by meal for the "meals" list
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

    // Transform map to array and format descriptions
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

/**
 * Get user's nutrition goals
 */
const getUserGoals = async (userId) => {
    const userDoc = await db.collection('users').doc(userId).get();
    const settings = userDoc.exists ? userDoc.data().settings : {};

    return {
        success: true,
        data: {
            targetCalories: settings.targetCalories || 2000,
            targetProtein: settings.targetProtein || 50,
            targetCarbs: settings.targetCarbs || 250,
            targetFat: settings.targetFat || 65
        }
    };
};

module.exports = {
    toolDeclarations,
    executeTool
};
