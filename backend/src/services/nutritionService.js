const logger = require('../logger');

// USDA FoodData Central API
const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';
const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';

/**
 * Search for foods in USDA database
 * @param {string} query - Food search term
 * @param {number} limit - Max results to return
 * @returns {Promise<Array>} Matching foods with nutrition info
 */
const searchFoods = async (query, limit = 5) => {
    try {
        const url = `${USDA_API_BASE}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=${limit}&dataType=Survey%20(FNDDS),Foundation,SR%20Legacy`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`USDA API error: ${response.status}`);
        }

        const data = await response.json();

        return (data.foods || []).map(food => ({
            fdcId: food.fdcId,
            name: food.description,
            brand: food.brandOwner || null,
            category: food.foodCategory || null,
            servingSize: food.servingSize || null,
            servingUnit: food.servingSizeUnit || null,
            nutrients: extractNutrients(food.foodNutrients || [])
        }));
    } catch (error) {
        logger.error({ err: error, query }, 'USDA search failed');
        return [];
    }
};

/**
 * Get detailed nutrition for a specific food by FDC ID
 * @param {number} fdcId - USDA FDC ID
 * @returns {Promise<Object|null>} Food with detailed nutrition
 */
const getFoodDetails = async (fdcId) => {
    try {
        const url = `${USDA_API_BASE}/food/${fdcId}?api_key=${USDA_API_KEY}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`USDA API error: ${response.status}`);
        }

        const food = await response.json();

        return {
            fdcId: food.fdcId,
            name: food.description,
            brand: food.brandOwner || null,
            category: food.foodCategory?.description || null,
            servingSize: food.servingSize || 100,
            servingUnit: food.servingSizeUnit || 'g',
            nutrients: extractNutrients(food.foodNutrients || [])
        };
    } catch (error) {
        logger.error({ err: error, fdcId }, 'USDA food details failed');
        return null;
    }
};

/**
 * Extract standard nutrients from USDA nutrients array
 */
const extractNutrients = (nutrients) => {
    const nutrientMap = {
        1008: 'calories',    // Energy (kcal)
        1003: 'protein',     // Protein (g)
        1005: 'carbs',       // Carbohydrate (g)
        1004: 'fat',         // Total lipid (fat) (g)
        1079: 'fiber',       // Fiber, total dietary (g)
        1063: 'sugar',       // Sugars, total (g)
        1093: 'sodium',      // Sodium, Na (mg)
    };

    const result = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0
    };

    nutrients.forEach(n => {
        const key = nutrientMap[n.nutrientId];
        if (key && n.value !== undefined) {
            result[key] = Math.round(n.value * 10) / 10;
        }
    });

    return result;
};

/**
 * Common food database for quick lookups (fallback when USDA is slow)
 * Values per standard serving
 */
const COMMON_FOODS = {
    'banana': { name: 'Banana, medium', quantity: 1, unit: 'medium', calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
    'apple': { name: 'Apple, medium', quantity: 1, unit: 'medium', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
    'egg': { name: 'Egg, large', quantity: 1, unit: 'large', calories: 78, protein: 6, carbs: 0.6, fat: 5 },
    'chicken breast': { name: 'Chicken breast, grilled', quantity: 4, unit: 'oz', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    'rice': { name: 'White rice, cooked', quantity: 1, unit: 'cup', calories: 205, protein: 4.3, carbs: 45, fat: 0.4 },
    'bread': { name: 'Bread, white', quantity: 1, unit: 'slice', calories: 79, protein: 2.7, carbs: 15, fat: 1 },
    'milk': { name: 'Milk, 2%', quantity: 1, unit: 'cup', calories: 122, protein: 8, carbs: 12, fat: 5 },
    'coffee': { name: 'Coffee, black', quantity: 1, unit: 'cup', calories: 2, protein: 0.3, carbs: 0, fat: 0 },
    'salad': { name: 'Mixed green salad', quantity: 2, unit: 'cups', calories: 20, protein: 2, carbs: 4, fat: 0.3 },
    'pasta': { name: 'Pasta, cooked', quantity: 1, unit: 'cup', calories: 220, protein: 8, carbs: 43, fat: 1.3 },
    'salmon': { name: 'Salmon, baked', quantity: 4, unit: 'oz', calories: 233, protein: 25, carbs: 0, fat: 14 },
    'oatmeal': { name: 'Oatmeal, cooked', quantity: 1, unit: 'cup', calories: 158, protein: 6, carbs: 27, fat: 3 },
    'yogurt': { name: 'Greek yogurt, plain', quantity: 1, unit: 'cup', calories: 130, protein: 17, carbs: 8, fat: 4 },
    'orange': { name: 'Orange, medium', quantity: 1, unit: 'medium', calories: 62, protein: 1.2, carbs: 15, fat: 0.2 },
    'avocado': { name: 'Avocado', quantity: 0.5, unit: 'whole', calories: 160, protein: 2, carbs: 9, fat: 15 },
};

/**
 * Quick lookup in common foods database
 * @param {string} query - Food name to search
 * @returns {Object|null} Food info or null if not found
 */
const quickLookup = (query) => {
    const lowerQuery = query.toLowerCase().trim();

    // Direct match
    if (COMMON_FOODS[lowerQuery]) {
        return COMMON_FOODS[lowerQuery];
    }

    // Partial match
    for (const [key, value] of Object.entries(COMMON_FOODS)) {
        if (lowerQuery.includes(key) || key.includes(lowerQuery)) {
            return value;
        }
    }

    return null;
};

/**
 * Calculate nutrition for a given quantity
 * @param {Object} baseNutrition - Nutrition per serving
 * @param {number} servings - Number of servings
 * @returns {Object} Scaled nutrition values
 */
const scaleNutrition = (baseNutrition, servings) => {
    return {
        calories: Math.round(baseNutrition.calories * servings),
        protein: Math.round(baseNutrition.protein * servings * 10) / 10,
        carbs: Math.round(baseNutrition.carbs * servings * 10) / 10,
        fat: Math.round(baseNutrition.fat * servings * 10) / 10,
        fiber: baseNutrition.fiber ? Math.round(baseNutrition.fiber * servings * 10) / 10 : null
    };
};

module.exports = {
    searchFoods,
    getFoodDetails,
    quickLookup,
    scaleNutrition,
    COMMON_FOODS
};
