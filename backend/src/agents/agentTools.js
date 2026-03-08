const { db } = require('../services/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const { GoogleGenAI } = require('@google/genai');
const { searchFoods, quickLookup } = require('../services/nutritionService');
const { getGoalsForDate, getUserSettings, snapshotGoals } = require('../services/goalsService');
const { calculateRecommendedTargets } = require('../services/nutritionCalculator');
const { checkBadgeEligibility } = require('../services/badgeService');
const { getLogger } = require('../logger');
const { getTodayStr, parseLocalDate, toDateStr } = require('../utils/dateUtils');

const searchGenAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const SEARCH_MODEL = 'gemini-3-flash-preview';

// --- Google Search rate limiting (global + per-user) ---
const GOOGLE_SEARCH_GLOBAL_DAILY_CAP = 500;
const GOOGLE_SEARCH_USER_DAILY_CAP = 20;
let googleSearchGlobalCount = 0;
let googleSearchGlobalResetDate = new Date().toDateString();
const googleSearchUserCounts = new Map(); // userId -> { count, resetDate }

const checkGoogleSearchBudget = (userId) => {
    const today = new Date().toDateString();
    // Reset global counter on new day
    if (googleSearchGlobalResetDate !== today) {
        googleSearchGlobalCount = 0;
        googleSearchGlobalResetDate = today;
        googleSearchUserCounts.clear();
    }
    // Check global cap
    if (googleSearchGlobalCount >= GOOGLE_SEARCH_GLOBAL_DAILY_CAP) return false;
    // Check per-user cap
    const userEntry = googleSearchUserCounts.get(userId);
    if (userEntry && userEntry.resetDate === today && userEntry.count >= GOOGLE_SEARCH_USER_DAILY_CAP) return false;
    return true;
};

const incrementGoogleSearchCount = (userId) => {
    googleSearchGlobalCount++;
    const today = new Date().toDateString();
    const userEntry = googleSearchUserCounts.get(userId);
    if (!userEntry || userEntry.resetDate !== today) {
        googleSearchUserCounts.set(userId, { count: 1, resetDate: today });
    } else {
        userEntry.count++;
    }
};

const VALID_MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const ALLOWED_UPDATE_KEYS = ['name', 'quantity', 'unit', 'calories', 'protein', 'carbs', 'fat', 'meal', 'date'];

// --- Token-overlap scoring (Jaccard similarity) ---
const scoreTokenMatch = (searchName, candidateName) => {
    const searchTokens = new Set(searchName.toLowerCase().split(/\s+/).filter(Boolean));
    const candidateTokens = new Set(candidateName.toLowerCase().split(/\s+/).filter(Boolean));
    if (searchTokens.size === 0 || candidateTokens.size === 0) return 0;
    const allTokens = new Set([...searchTokens, ...candidateTokens]);
    const matching = [...searchTokens].filter(t => candidateTokens.has(t));
    return matching.length / allTokens.size;
};

const computeCompositeScore = (tokenScore, createdAt, frequencyCount, maxFrequency) => {
    // Recency: 1.0 if today, linear decay to 0.0 at 90 days ago
    const daysAgo = createdAt
        ? (Date.now() - (createdAt.toDate?.()?.getTime?.() || createdAt)) / (1000 * 60 * 60 * 24)
        : 90;
    const recencyScore = Math.max(0, Math.min(1, 1 - (daysAgo / 90)));

    // Frequency: normalized against the most frequent item in candidates
    const frequencyScore = maxFrequency > 0 ? frequencyCount / maxFrequency : 0;

    return (tokenScore * 0.7) + (recencyScore * 0.15) + (frequencyScore * 0.15);
};

const validateNutrients = (item) => {
    const warnings = [];
    const cal = Number(item.calories) || 0;
    const pro = Number(item.protein) || 0;
    const carb = Number(item.carbs) || 0;
    const f = Number(item.fat) || 0;

    if (cal < 0 || cal > 3000) warnings.push(`${item.name}: calories (${cal}) outside expected range 0-3000`);
    if (pro < 0 || pro > 300) warnings.push(`${item.name}: protein (${pro}g) outside expected range 0-300g`);
    if (carb < 0 || carb > 500) warnings.push(`${item.name}: carbs (${carb}g) outside expected range 0-500g`);
    if (f < 0 || f > 200) warnings.push(`${item.name}: fat (${f}g) outside expected range 0-200g`);

    // Calories below macro sum by more than 10% is physically impossible
    const macroSum = (pro * 4) + (carb * 4) + (f * 9);
    if (macroSum > 0 && cal < macroSum * 0.9) {
        warnings.push(`${item.name}: stated ${cal} cal but macros suggest ~${Math.round(macroSum)} cal. Values were saved but may need correction.`);
    }
    return warnings;
};

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
                    enum: ['ai_estimate', 'usda', 'common_foods', 'user_input', 'nutrition_label', 'user_history'],
                    description: 'Source of the nutrition data. Use "ai_estimate" if you estimated it, "usda" if from lookupNutrition USDA, "common_foods" if from lookupNutrition fallback, "user_input" if user explicitly provided macros, "nutrition_label" if from a photo/label, "user_history" if from lookupNutrition user history match.'
                }
            },
            required: ['date', 'meal', 'items', 'nutritionSource']
        }
    },
    {
        name: 'lookupNutrition',
        description: 'Look up nutrition information for a food item from the USDA database. You SHOULD call this for ALL foods before logging — it returns authoritative USDA data when available, with common foods as fallback. Only skip this for trivial items (plain water, black coffee, a single piece of common fruit).',
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
        description: 'Search past food logs. Returns full nutrition data. Searches the last 2 days by default. Use `date` for a specific end date, `startDate` for a custom range start. Use this BEFORE updateFoodLog/deleteFoodLog to find logIds, or when the user references a past meal.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search term (e.g., "coffee", "breakfast", "tuna")'
                },
                date: {
                    type: 'string',
                    description: 'End date in YYYY-MM-DD format (defaults to today)'
                },
                startDate: {
                    type: 'string',
                    description: 'Start date for range search in YYYY-MM-DD format. Defaults to 2 days before date.'
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
    },
    {
        name: 'triggerWeeklyReview',
        description: 'Generate the user\'s weekly nutrition review. Only call this when the user agrees to do their weekly review — context will tell you when it\'s review day and the review hasn\'t been done yet. The review analyzes this week vs last week, highlights wins and patterns, and sets a focus for next week. Returns the full review text which you should present conversationally.',
        parameters: {
            type: 'object',
            properties: {}
        }
    }
];

const executeTool = async (toolName, args, userId, userTimezone, idempotencyKey, options = {}) => {
    try {
        switch (toolName) {
            case 'logFood':
                return await logFood(args, userId, userTimezone, idempotencyKey, options);
            case 'lookupNutrition':
                return await lookupNutrition(args, userId, options);
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
            case 'triggerWeeklyReview':
                return await triggerWeeklyReviewTool(userId, userTimezone);
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

    // Nutrient validation — warn but always save
    const nutrientWarnings = [];
    for (const item of items) {
        const itemWarnings = validateNutrients(item);
        nutrientWarnings.push(...itemWarnings);
    }
    if (nutrientWarnings.length > 0) {
        getLogger().warn({ action: 'tool.logFood.nutrientValidation', warnings: nutrientWarnings }, 'Nutrient validation warnings');
    }

    const batch = db.batch();
    const createdIds = [];
    const lookupCache = options.lookupCache;

    for (const item of items) {
        const docRef = db.collection('users').doc(userId).collection('foodLogs').doc();

        // Resolve nutritionSource from lookup cache — try exact match, then fuzzy
        let resolvedNutritionSource = nutritionSource || 'ai_estimate';
        if (lookupCache && lookupCache.size > 0) {
            const itemKey = item.name.toLowerCase().trim();
            let cacheEntry = lookupCache.get(itemKey);

            // Fuzzy match: find best token-scored cache key if exact match fails
            if (!cacheEntry) {
                let bestScore = 0;
                for (const [key, value] of lookupCache.entries()) {
                    const score = scoreTokenMatch(itemKey, key);
                    if (score > bestScore) {
                        bestScore = score;
                        cacheEntry = value;
                    }
                }
                if (bestScore < 0.4) cacheEntry = null;
            }

            if (cacheEntry) {
                if (cacheEntry.source !== resolvedNutritionSource) {
                    getLogger().info({
                        action: 'tool.logFood.sourceOverride',
                        item: item.name,
                        aiSaid: resolvedNutritionSource,
                        actual: cacheEntry.source
                    }, 'Overriding AI nutritionSource with cached lookup result');
                }
                resolvedNutritionSource = cacheEntry.source;
            }
        }

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
            nutritionSource: resolvedNutritionSource,
            corrected: false,
            nutrientsCorrected: false,
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
                date: item.date,
                nutritionSource: item.nutritionSource,
                corrected: item.corrected,
                nutrientsCorrected: item.nutrientsCorrected
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

    if (nutrientWarnings.length > 0) {
        result.warnings = nutrientWarnings;
    }

    return result;
};

// --- Google Search grounded nutrition lookup (fallback when USDA fails) ---
const googleSearchNutrition = async (foodName) => {
    getLogger().info({ action: 'tool.googleSearchNutrition', foodName }, 'Google Search: attempting nutrition lookup');
    try {
        const result = await searchGenAI.models.generateContent({
            model: SEARCH_MODEL,
            contents: `What are the nutrition facts for "${foodName}"? Return ONLY a JSON object with these exact keys: name (product name), calories, protein, carbs, fat, quantity (number), unit (serving unit). Use per-serving values. No markdown, no explanation, just the JSON object.`,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 1.0,
                maxOutputTokens: 2048,
                thinkingConfig: { thinkingLevel: 'MINIMAL' },
            }
        });

        const text = result.text?.trim();
        if (!text) return null;

        // Extract JSON object from response (handles markdown fences, surrounding text)
        const jsonMatch = text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        const parsed = JSON.parse(jsonMatch[0]);

        // Validate required fields
        if (!parsed.name || parsed.calories == null) {
            getLogger().warn({ action: 'tool.googleSearchNutrition', foodName, parsed }, 'Google Search: incomplete response');
            return null;
        }

        return {
            name: parsed.name,
            calories: Math.round(Number(parsed.calories) || 0),
            protein: Math.round((Number(parsed.protein) || 0) * 10) / 10,
            carbs: Math.round((Number(parsed.carbs) || 0) * 10) / 10,
            fat: Math.round((Number(parsed.fat) || 0) * 10) / 10,
            quantity: parsed.quantity || 1,
            unit: parsed.unit || 'serving'
        };
    } catch (err) {
        getLogger().warn({ err, foodName }, 'Google Search nutrition lookup failed');
        return null;
    }
};

const lookupNutrition = async (args, userId, options = {}) => {
    const { foodName } = args;
    const { lookupCache } = options;
    const cacheKey = foodName.toLowerCase().trim();

    // 1. User history — corrected entries and authoritative sources
    if (userId) {
        try {
            const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');

            const [authoritativeSnap, correctedSnap] = await Promise.all([
                foodLogsRef
                    .where('nutritionSource', 'in', ['usda', 'nutrition_label', 'user_input'])
                    .orderBy('createdAt', 'desc')
                    .limit(50)
                    .get(),
                foodLogsRef
                    .where('nutrientsCorrected', '==', true)
                    .orderBy('createdAt', 'desc')
                    .limit(50)
                    .get()
            ]);

            // Merge and dedupe by doc ID — corrected first (higher trust)
            const seen = new Set();
            const candidates = [];
            for (const snap of [correctedSnap, authoritativeSnap]) {
                for (const doc of snap.docs) {
                    if (!seen.has(doc.id)) {
                        seen.add(doc.id);
                        candidates.push({ id: doc.id, ...doc.data() });
                    }
                }
            }

            // Score candidates using token-overlap + recency + frequency
            const lowerFood = foodName.toLowerCase();

            // Count frequency per normalized name
            const frequencyCounts = {};
            for (const c of candidates) {
                const key = c.name?.toLowerCase().trim() || '';
                frequencyCounts[key] = (frequencyCounts[key] || 0) + 1;
            }
            const maxFrequency = Math.max(...Object.values(frequencyCounts), 1);

            const scored = candidates
                .filter(c => c.name)
                .map(c => {
                    const tokenScore = scoreTokenMatch(lowerFood, c.name);
                    const freqKey = c.name.toLowerCase().trim();
                    const composite = computeCompositeScore(tokenScore, c.createdAt, frequencyCounts[freqKey] || 1, maxFrequency);
                    return { ...c, tokenScore, composite };
                })
                .filter(c => c.tokenScore >= 0.4)
                .sort((a, b) => b.composite - a.composite);

            const matches = scored;

            if (matches.length > 0) {
                const best = matches[0];
                const resolvedSource = best.nutrientsCorrected
                    ? 'user_input'
                    : (best.nutritionSource || 'user_history');
                getLogger().info({ action: 'tool.lookupNutrition', foodName, source: resolvedSource,
                    matchedName: best.name, corrected: best.nutrientsCorrected || false,
                    score: best.composite?.toFixed(3), tokenScore: best.tokenScore?.toFixed(3)
                }, 'Nutrition lookup: user history match');
                if (lookupCache) {
                    lookupCache.set(cacheKey, { source: resolvedSource, matchedName: best.name });
                    lookupCache.set(best.name.toLowerCase().trim(), { source: resolvedSource, matchedName: best.name });
                }
                return {
                    success: true,
                    source: resolvedSource,
                    data: {
                        name: best.name,
                        calories: best.calories,
                        protein: best.protein,
                        carbs: best.carbs,
                        fat: best.fat,
                        quantity: best.quantity,
                        unit: best.unit,
                        originalSource: best.nutritionSource,
                        corrected: best.nutrientsCorrected || false,
                        date: best.date
                    },
                    alternatives: matches.slice(1, 3).map(m => ({
                        name: m.name,
                        calories: m.calories,
                        protein: m.protein,
                        carbs: m.carbs,
                        fat: m.fat,
                        quantity: m.quantity,
                        unit: m.unit,
                        originalSource: m.nutritionSource,
                        corrected: m.nutrientsCorrected || false,
                        date: m.date
                    }))
                };
            }
        } catch (err) {
            getLogger().warn({ err, foodName }, 'User history lookup failed, falling through to USDA');
        }
    }

    // 2. USDA — most authoritative external source (with token scoring filter)
    const MIN_USDA_SCORE = 0.6;
    const usdaResults = await searchFoods(foodName, 5);
    if (usdaResults.length > 0) {
        const scoredUsda = usdaResults
            .map(r => ({ ...r, tokenScore: scoreTokenMatch(foodName, r.name) }))
            .filter(r => r.tokenScore >= MIN_USDA_SCORE)
            .sort((a, b) => b.tokenScore - a.tokenScore);

        if (scoredUsda.length > 0) {
            const best = scoredUsda[0];
            getLogger().info({ action: 'tool.lookupNutrition', foodName, source: 'usda',
                matchedName: best.name, tokenScore: best.tokenScore.toFixed(3),
                resultCount: scoredUsda.length, filteredOut: usdaResults.length - scoredUsda.length
            }, 'Nutrition lookup: USDA match');
            if (lookupCache) {
                lookupCache.set(cacheKey, { source: 'usda', matchedName: best.name });
                lookupCache.set(best.name.toLowerCase().trim(), { source: 'usda', matchedName: best.name });
            }
            return {
                success: true,
                source: 'usda',
                data: best,
                alternatives: scoredUsda.slice(1, 3)
            };
        } else {
            getLogger().info({ action: 'tool.lookupNutrition', foodName,
                bestUsdaName: usdaResults[0].name,
                bestUsdaScore: scoreTokenMatch(foodName, usdaResults[0].name).toFixed(3)
            }, 'Nutrition lookup: USDA results filtered out (low relevance)');
        }
    }

    // 3. Google Search grounded fallback (rate-limited)
    let googleResult = null;
    if (checkGoogleSearchBudget(userId)) {
        googleResult = await googleSearchNutrition(foodName);
        if (googleResult) incrementGoogleSearchCount(userId);
    } else {
        getLogger().info({ action: 'tool.lookupNutrition', foodName, globalCount: googleSearchGlobalCount }, 'Google Search: skipped (daily cap reached)');
    }
    if (googleResult) {
        getLogger().info({ action: 'tool.lookupNutrition', foodName, source: 'google_search',
            matchedName: googleResult.name
        }, 'Nutrition lookup: Google Search match');
        if (lookupCache) {
            lookupCache.set(cacheKey, { source: 'google_search', matchedName: googleResult.name });
            lookupCache.set(googleResult.name.toLowerCase().trim(), { source: 'google_search', matchedName: googleResult.name });
        }
        return {
            success: true,
            source: 'google_search',
            data: googleResult
        };
    }

    // 4. Common foods fallback
    const quickResult = quickLookup(foodName);
    if (quickResult) {
        getLogger().info({ action: 'tool.lookupNutrition', foodName, source: 'common_foods',
            matchedName: quickResult.name
        }, 'Nutrition lookup: common_foods match');
        if (lookupCache) {
            lookupCache.set(cacheKey, { source: 'common_foods', matchedName: quickResult.name });
            lookupCache.set(quickResult.name.toLowerCase().trim(), { source: 'common_foods', matchedName: quickResult.name });
        }
        return {
            success: true,
            source: 'common_foods',
            data: quickResult
        };
    }

    // 4. Nothing found — do NOT cache failures, let AI's ai_estimate stand
    getLogger().info({ action: 'tool.lookupNutrition', foodName, source: 'none'
    }, 'Nutrition lookup: no match found');
    return {
        success: false,
        source: 'none',
        error: `No nutrition data found for "${foodName}". Estimate based on your knowledge and use nutritionSource "ai_estimate" when logging.`
    };
};

const searchFoodLogs = async (args, userId, userTimezone) => {
    let { query, date, startDate } = args;

    if (!date) {
        date = getTodayStr(userTimezone);
    }

    // Backward compat: convert legacy daysBack to startDate
    if (args.daysBack != null && !startDate) {
        const daysBack = Math.min(Math.max(args.daysBack, 0), 30);
        const start = parseLocalDate(date);
        start.setDate(start.getDate() - daysBack);
        startDate = toDateStr(start);
    }

    // Default: last 3 calendar days (today, yesterday, day before)
    if (!startDate) {
        const defaultStart = parseLocalDate(date);
        defaultStart.setDate(defaultStart.getDate() - 2);
        startDate = toDateStr(defaultStart);
    }

    // Cap at 30 days
    const diffDays = (parseLocalDate(date) - parseLocalDate(startDate)) / 86400000;
    if (diffDays > 30) {
        const capped = parseLocalDate(date);
        capped.setDate(capped.getDate() - 30);
        startDate = toDateStr(capped);
    }

    try {
        const logsRef = db.collection('users').doc(userId).collection('foodLogs');
        const snapshot = await logsRef
            .where('date', '>=', startDate)
            .where('date', '<=', date)
            .limit(200)
            .get();

        if (snapshot.empty) {
            return { success: true, data: { count: 0, matches: [], message: `No matching food logs found from ${startDate} to ${date}` } };
        }

        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const mapMatch = (m) => ({
            id: m.id,
            name: m.name,
            meal: m.meal,
            date: m.date,
            quantity: m.quantity,
            unit: m.unit,
            calories: m.calories,
            protein: m.protein,
            carbs: m.carbs,
            fat: m.fat,
            nutritionSource: m.nutritionSource,
            corrected: m.nutrientsCorrected || m.corrected || false,
            time: m.createdAt?.toDate?.()?.toLocaleTimeString() || 'N/A'
        });

        if (!query) {
            return {
                success: true,
                data: {
                    count: logs.length,
                    startDate,
                    endDate: date,
                    matches: logs.map(mapMatch)
                }
            };
        }

        // Score and rank logs by token overlap, filter out irrelevant results
        const MIN_SEARCH_SCORE = 0.2;
        const scored = logs
            .map(log => {
                const nameScore = log.name ? scoreTokenMatch(query, log.name) : 0;
                const mealScore = log.meal ? scoreTokenMatch(query, log.meal) : 0;
                const score = Math.max(nameScore, mealScore);
                return { ...log, score };
            })
            .filter(log => log.score >= MIN_SEARCH_SCORE)
            .sort((a, b) => b.score - a.score);

        return {
            success: true,
            data: {
                count: scored.length,
                startDate,
                endDate: date,
                matches: scored.map(mapMatch)
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

    const NUTRIENT_KEYS = ['calories', 'protein', 'carbs', 'fat'];
    if (NUTRIENT_KEYS.some(k => k in cleanUpdates)) {
        cleanUpdates.nutrientsCorrected = true;
    }

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

    // Invalidate context cache so next chat picks up updated biometrics/goals
    try {
        const { invalidateContextCache } = require('../services/geminiService');
        invalidateContextCache();
    } catch (err) {
        getLogger().warn({ err }, 'Failed to invalidate context cache after profile update');
    }

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

const triggerWeeklyReviewTool = async (userId, userTimezone) => {
    // Lazy require to avoid circular dependency: agentTools → weeklyReviewService → geminiService → agentTools
    const { generateWeeklyReview } = require('../services/weeklyReviewService');
    const tz = userTimezone || 'America/New_York';

    try {
        const result = await generateWeeklyReview(userId, tz, { skipChatMessage: true });

        if (!result) {
            return {
                success: true,
                message: 'A weekly review has already been generated today.',
                data: { alreadyGenerated: true }
            };
        }

        return {
            success: true,
            message: result.message,
            data: {
                reviewText: result.message,
                focus: result.focus,
                messageId: result.messageId
            }
        };
    } catch (error) {
        getLogger().error({ err: error, userId }, 'Weekly review tool failed');
        return { success: false, error: 'Failed to generate weekly review. Try again later.' };
    }
};

module.exports = {
    toolDeclarations,
    executeTool
};
