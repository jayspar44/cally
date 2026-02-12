/**
 * Nutrition calculator using Mifflin-St Jeor equation.
 * Calculates BMR, TDEE, and recommended macro targets based on user biometrics.
 */

const ACTIVITY_MULTIPLIERS = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
};

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor.
 * Weight in kg, height in cm, age in years.
 */
const calculateBMR = (weightKg, heightCm, age, gender) => {
    const base = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
    return gender === 'female' ? base - 161 : base + 5;
};

/**
 * Calculate Total Daily Energy Expenditure.
 */
const calculateTDEE = (bmr, activityLevel) => {
    const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.sedentary;
    return Math.round(bmr * multiplier);
};

/**
 * Convert weight/height to metric if needed.
 */
const toMetric = (biometrics) => {
    let weightKg = biometrics.weight;
    if (biometrics.weightUnit === 'lbs' || !biometrics.weightUnit) {
        weightKg = biometrics.weight * 0.453592;
    }

    let heightCm = biometrics.height;
    if (biometrics.heightUnit === 'in' || !biometrics.heightUnit) {
        heightCm = (biometrics.height || 0) * 2.54;
    }

    return { weightKg, heightCm };
};

/**
 * Calculate recommended nutrition targets from biometrics.
 * Returns targets + calculation details for transparency.
 */
const calculateRecommendedTargets = (biometrics) => {
    const { weight, height, age, gender, activityLevel, goalType, weightUnit } = biometrics;

    if (!weight) {
        return { error: 'Weight is required to calculate recommendations.' };
    }

    const { weightKg, heightCm } = toMetric(biometrics);
    const weightLbs = (weightUnit === 'kg') ? weight * 2.20462 : weight;

    // BMR requires height, age, gender — use defaults if not provided
    const effectiveHeight = heightCm || 170; // ~5'7" default
    const effectiveAge = age || 30;
    const effectiveGender = gender || 'male';

    const bmr = Math.round(calculateBMR(weightKg, effectiveHeight, effectiveAge, effectiveGender));
    const tdee = calculateTDEE(bmr, activityLevel || 'sedentary');

    let targetCalories;
    let proteinPerLb;
    let proteinRange;
    let calorieAdjustment;

    switch (goalType) {
        case 'lose_weight':
            targetCalories = tdee - 500;
            proteinPerLb = 0.75; // midpoint of 0.7-0.8
            proteinRange = '0.7–0.8g/lb';
            calorieAdjustment = 'TDEE - 500 cal (moderate deficit)';
            break;
        case 'gain_muscle':
            targetCalories = tdee + 300;
            proteinPerLb = 0.9; // midpoint of 0.8-1.0
            proteinRange = '0.8–1.0g/lb';
            calorieAdjustment = 'TDEE + 300 cal (lean surplus)';
            break;
        default: // maintain
            targetCalories = tdee;
            proteinPerLb = 0.55; // midpoint of 0.5-0.6
            proteinRange = '0.5–0.6g/lb';
            calorieAdjustment = 'TDEE (maintenance)';
            break;
    }

    const targetProtein = Math.round(weightLbs * proteinPerLb);
    // Remaining calories split: ~55% carbs, ~25% fat (after protein)
    const proteinCalories = targetProtein * 4;
    const remainingCalories = targetCalories - proteinCalories;
    const targetFat = Math.round((remainingCalories * 0.3) / 9);
    const targetCarbs = Math.round((remainingCalories * 0.7) / 4);

    return {
        targetCalories: Math.max(targetCalories, 1200), // safety floor
        targetProtein,
        targetCarbs,
        targetFat,
        calculationDetails: {
            bmr,
            tdee,
            calorieAdjustment,
            proteinRange,
            weightUsed: `${weight} ${weightUnit || 'lbs'}`,
            heightUsed: height ? `${height} ${biometrics.heightUnit || 'in'}` : 'default (170cm)',
            ageUsed: age || 'default (30)',
            genderUsed: effectiveGender,
            activityLevel: activityLevel || 'sedentary',
            goalType: goalType || 'maintain',
        }
    };
};

module.exports = { calculateBMR, calculateTDEE, calculateRecommendedTargets };
