const logger = require('../logger');

const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';
const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';

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

const mapFoodResult = (food) => ({
    fdcId: food.fdcId,
    name: food.description,
    brand: food.brandOwner || null,
    category: food.foodCategory || null,
    servingSize: food.servingSize || null,
    servingUnit: food.servingSizeUnit || null,
    nutrients: extractNutrients(food.foodNutrients || [])
});

const searchFoods = async (query, limit = 5) => {
    const doSearch = async (searchQuery) => {
        const sanitizedQuery = searchQuery.replace(/[()]/g, '');

        const response = await fetch(`${USDA_API_BASE}/foods/search?api_key=${USDA_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: sanitizedQuery,
                pageSize: limit,
                dataType: ['Survey (FNDDS)', 'Foundation', 'Branded']
            })
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            const error = new Error(`USDA API error: ${response.status} - ${errorBody}`);
            error.status = response.status;
            throw error;
        }

        const data = await response.json();
        return (data.foods || []).map(mapFoodResult);
    };

    try {
        return await doSearch(query);
    } catch (error) {
        if (error.status === 500 || error.status === 504) {
            const simplified = query
                .replace(/\d+\/?\d*\s*(cups?|oz|tbsp|tsp|g|ml|lbs?|pieces?|slices?|servings?)\b/gi, '')
                .replace(/\d+\/\d+/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            if (simplified && simplified !== query) {
                logger.info({ originalQuery: query, simplifiedQuery: simplified }, 'USDA retry with simplified query');
                try {
                    return await doSearch(simplified);
                } catch (retryError) {
                    logger.error({ err: retryError, query: simplified }, 'USDA retry also failed');
                    return [];
                }
            }
        }

        logger.error({ err: error, query }, 'USDA search failed');
        return [];
    }
};

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

module.exports = {
    searchFoods,
    quickLookup,
    COMMON_FOODS
};
