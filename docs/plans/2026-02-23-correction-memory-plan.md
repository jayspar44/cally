# Correction Memory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When logging food, Kalli checks the user's past logs for authoritative nutrition data before calling USDA — so user corrections, label scans, and USDA-verified entries are remembered and reused automatically.

**Architecture:** Bake a user history query into the existing `lookupNutrition` tool as the first step (before USDA). Add a `nutrientsCorrected` flag that fires only when nutrition values change. Fix the frontend `FoodEditModal` to send only changed fields so `nutrientsCorrected` doesn't false-positive.

**Tech Stack:** Firestore composite queries, Express/Node.js backend, React frontend

**Design doc:** `docs/plans/2026-02-23-correction-memory-design.md`

---

### Task 1: FoodEditModal — Only Send Changed Fields

**Files:**
- Modify: `frontend/src/components/common/FoodEditModal.jsx:43-53`

**Step 1: Replace handleSubmit with diff logic**

Replace lines 43-53 in `FoodEditModal.jsx`:

```jsx
// CURRENT (lines 43-53):
const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
        ...formData,
        quantity: Number(formData.quantity),
        calories: Number(formData.calories),
        protein: Number(formData.protein),
        carbs: Number(formData.carbs),
        fat: Number(formData.fat)
    });
};

// NEW:
const handleSubmit = (e) => {
    e.preventDefault();
    const changes = {};
    const numericKeys = ['quantity', 'calories', 'protein', 'carbs', 'fat'];
    for (const [key, val] of Object.entries(formData)) {
        const newVal = numericKeys.includes(key) ? Number(val) : val;
        if (newVal !== initialData[key]) changes[key] = newVal;
    }
    if (Object.keys(changes).length > 0) {
        onSave(changes);
    }
};
```

**Step 2: Verify the change works**

1. Start dev servers: `npm run dev:local` from project root
2. Open http://localhost:3500, navigate to Chat
3. Find a food log card, click the edit pencil on an item
4. Change ONLY the protein value, click Save
5. Check the Network tab — the PUT request body should contain only the changed field(s), not all fields

**Step 3: Commit**

```bash
git add frontend/src/components/common/FoodEditModal.jsx
git commit -m "fix: FoodEditModal sends only changed fields on save"
```

---

### Task 2: Add `nutrientsCorrected` Flag

**Files:**
- Modify: `backend/src/agents/agentTools.js:582-587` (updateFoodLog)
- Modify: `backend/src/controllers/foodController.js:148-154` (updateLog)

**Step 1: Add nutrientsCorrected detection to agentTools.js updateFoodLog**

In `backend/src/agents/agentTools.js`, after the existing `cleanUpdates.corrected = true;` line (587), add the nutrientsCorrected detection. Replace lines 586-587:

```js
// CURRENT (lines 586-587):
    cleanUpdates.updatedAt = FieldValue.serverTimestamp();
    cleanUpdates.corrected = true;

// NEW:
    cleanUpdates.updatedAt = FieldValue.serverTimestamp();
    cleanUpdates.corrected = true;

    const NUTRIENT_KEYS = ['calories', 'protein', 'carbs', 'fat'];
    if (NUTRIENT_KEYS.some(k => k in cleanUpdates)) {
        cleanUpdates.nutrientsCorrected = true;
    }
```

**Step 2: Add nutrientsCorrected detection to foodController.js updateLog**

In `backend/src/controllers/foodController.js`, after the existing `cleanUpdates.corrected = true;` line (154), add the same detection. Replace lines 153-154:

```js
// CURRENT (lines 153-154):
        cleanUpdates.updatedAt = FieldValue.serverTimestamp();
        cleanUpdates.corrected = true;

// NEW:
        cleanUpdates.updatedAt = FieldValue.serverTimestamp();
        cleanUpdates.corrected = true;

        const NUTRIENT_KEYS = ['calories', 'protein', 'carbs', 'fat'];
        if (NUTRIENT_KEYS.some(k => k in cleanUpdates)) {
            cleanUpdates.nutrientsCorrected = true;
        }
```

**Step 3: Verify the change works**

1. Open http://localhost:3500, navigate to Chat
2. Edit a food log item and change only the protein value → Save
3. Check Firestore (via Firebase MCP or console) — the document should have `nutrientsCorrected: true`
4. Edit a food log item and change only the meal type → Save
5. Check Firestore — the document should NOT have `nutrientsCorrected: true`

**Step 4: Commit**

```bash
git add backend/src/agents/agentTools.js backend/src/controllers/foodController.js
git commit -m "feat: add nutrientsCorrected flag for nutrition-specific updates"
```

---

### Task 3: Bake User History Query into `lookupNutrition`

**Files:**
- Modify: `backend/src/agents/agentTools.js:201-207` (executeTool — pass userId to lookupNutrition)
- Modify: `backend/src/agents/agentTools.js:453-482` (lookupNutrition function)
- Modify: `backend/src/agents/agentTools.js:56-58` (logFood nutritionSource enum — add 'user_history')

**Step 1: Add `user_history` to the logFood nutritionSource enum**

In `backend/src/agents/agentTools.js`, update the `nutritionSource` enum on line 57:

```js
// CURRENT (line 57):
                    enum: ['ai_estimate', 'usda', 'common_foods', 'user_input', 'nutrition_label'],

// NEW:
                    enum: ['ai_estimate', 'usda', 'common_foods', 'user_input', 'nutrition_label', 'user_history'],
```

Also update the description on line 58:

```js
// CURRENT (line 58):
                    description: 'Source of the nutrition data. Use "ai_estimate" if you estimated it, "usda" if you used lookupNutrition and found it in USDA, "common_foods" if you used lookupNutrition and found it there, "user_input" if the user explicitly provided macros, "nutrition_label" if from an image/label.'

// NEW:
                    description: 'Source of the nutrition data. Use "ai_estimate" if you estimated it, "usda" if from lookupNutrition USDA, "common_foods" if from lookupNutrition fallback, "user_input" if user explicitly provided macros, "nutrition_label" if from a photo/label, "user_history" if from lookupNutrition user history match.'
```

**Step 2: Pass userId to lookupNutrition in executeTool**

In `backend/src/agents/agentTools.js`, update the `lookupNutrition` case in `executeTool` (line 207):

```js
// CURRENT (line 207):
            case 'lookupNutrition':
                return await lookupNutrition(args);

// NEW:
            case 'lookupNutrition':
                return await lookupNutrition(args, userId);
```

**Step 3: Rewrite lookupNutrition to check user history first**

Replace the entire `lookupNutrition` function (lines 453-482):

```js
const lookupNutrition = async (args, userId) => {
    const { foodName } = args;

    // 1. User history — corrected entries and authoritative sources
    if (userId) {
        try {
            const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');

            // Two parallel queries (Firestore can't OR across different fields)
            const [authoritativeSnap, correctedSnap] = await Promise.all([
                foodLogsRef
                    .where('nutritionSource', 'in', ['usda', 'nutrition_label', 'user_input'])
                    .orderBy('createdAt', 'desc')
                    .limit(10)
                    .get(),
                foodLogsRef
                    .where('nutrientsCorrected', '==', true)
                    .orderBy('createdAt', 'desc')
                    .limit(10)
                    .get()
            ]);

            // Merge and dedupe by doc ID
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

            // Filter by name match (case-insensitive substring)
            const lowerFood = foodName.toLowerCase();
            const matches = candidates.filter(c =>
                c.name && c.name.toLowerCase().includes(lowerFood)
            );

            if (matches.length > 0) {
                const best = matches[0];
                return {
                    success: true,
                    source: 'user_history',
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

    // 2. USDA — most authoritative external source
    const usdaResults = await searchFoods(foodName, 3);
    if (usdaResults.length > 0) {
        return {
            success: true,
            source: 'usda',
            data: usdaResults[0],
            alternatives: usdaResults.slice(1)
        };
    }

    // 3. Common foods fallback
    const quickResult = quickLookup(foodName);
    if (quickResult) {
        return {
            success: true,
            source: 'common_foods',
            data: quickResult
        };
    }

    // 4. Nothing found
    return {
        success: false,
        source: 'none',
        error: `No nutrition data found for "${foodName}". Estimate based on your knowledge and use nutritionSource "ai_estimate" when logging.`
    };
};
```

**Step 4: Verify locally**

1. Restart dev servers: kill and restart `npm run dev:local`
2. In the app chat, log a food that you've previously logged with USDA source (e.g., "I had an apple")
3. Check terminal logs — should see lookupNutrition execute with the user history query first
4. If the food was previously logged, it should return `source: 'user_history'`
5. If not found in history, should fall through to USDA as before

**Step 5: Commit**

```bash
git add backend/src/agents/agentTools.js
git commit -m "feat: bake user history lookup into lookupNutrition"
```

---

### Task 4: Update System Prompt with New Priority & Specificity Instructions

**Files:**
- Modify: `backend/src/services/geminiService.js:150-162` (Nutrition Source Tracking section)

**Step 1: Update the Nutrition Source Tracking section**

Replace lines 150-162 in `geminiService.js`:

```js
// CURRENT (lines 150-162):
- **Nutrition Source Tracking**: When using \`logFood\`, you MUST specify the \`nutritionSource\` field accurately based on where the data came from.

## Nutrition Source Tracking
Set \`nutritionSource\` in \`logFood\` based on where the numbers ACTUALLY came from:
- **"nutrition_label"** — You extracted values from a photo of a nutrition/ingredients label
- **"user_input"** — The user explicitly told you the macros/calories (e.g. "it was 350 cals")
- **"usda"** — lookupNutrition returned \`success: true\` with \`source: "usda"\`
- **"common_foods"** — lookupNutrition returned \`success: true\` with \`source: "common_foods"\`
- **"ai_estimate"** — lookupNutrition returned \`success: false\` (or was not called), so you estimated from your own knowledge

**CRITICAL**: If lookupNutrition returned \`success: false\` for a food, you MUST use "ai_estimate" for that item — never "usda" or "common_foods".

Always call lookupNutrition before falling back to ai_estimate. The only exceptions are truly trivial items (plain water, black coffee, a single piece of common fruit).

// NEW:
- **Nutrition Source Tracking**: When using \`logFood\`, you MUST specify the \`nutritionSource\` field accurately based on where the data came from.

## Nutrition Source Tracking
Set \`nutritionSource\` in \`logFood\` based on where the numbers ACTUALLY came from:
- **"nutrition_label"** — You extracted values from a photo of a nutrition/ingredients label
- **"user_input"** — The user explicitly told you the macros/calories (e.g. "it was 350 cals")
- **"user_history"** — lookupNutrition returned \`source: "user_history"\`
- **"usda"** — lookupNutrition returned \`success: true\` with \`source: "usda"\`
- **"common_foods"** — lookupNutrition returned \`success: true\` with \`source: "common_foods"\`
- **"ai_estimate"** — lookupNutrition returned \`success: false\` (or was not called), so you estimated from your own knowledge

**Source priority** (highest to lowest): nutrition_label > user_input > user_history > usda > common_foods > ai_estimate

**CRITICAL**: If lookupNutrition returned \`success: false\` for a food, you MUST use "ai_estimate" for that item — never "usda" or "common_foods".

Always call lookupNutrition before falling back to ai_estimate. The only exceptions are truly trivial items (plain water, black coffee, a single piece of common fruit).

## User History in lookupNutrition
\`lookupNutrition\` now checks the user's past food logs FIRST — before USDA. It returns \`source: "user_history"\` when it finds a match from a past corrected entry or an entry from an authoritative source (usda, nutrition_label, user_input).

**Name specificity matters** — "Barebells Banana Caramel" is NOT "Barebells Salted Caramel". Only use a history match if the food is genuinely the same item. If the match seems wrong or too generic, ignore it and the tool will fall through to USDA automatically.

**Scale by quantity** — history data is per the logged quantity. If history shows 1 bar = 200 cal and user had 2 bars, log 400 cal. If history shows 5oz pasta = 275 cal and user had 2oz, scale proportionally.

**Corrected entries are most trusted** — the user explicitly fixed these values. When a history result has \`corrected: true\`, prefer it over USDA data.
```

**Step 2: Verify the prompt looks correct**

Read the updated file to confirm the system prompt reads naturally and the new section is properly placed.

**Step 3: Commit**

```bash
git add backend/src/services/geminiService.js
git commit -m "feat: update system prompt with user history source and specificity instructions"
```

---

### Task 5: Add Firestore Composite Indexes

**Files:**
- Modify: `firestore.indexes.json`

**Step 1: Add composite indexes**

The two Firestore queries in `lookupNutrition` need composite indexes on the `foodLogs` subcollection:

1. `nutritionSource` ASC + `createdAt` DESC
2. `nutrientsCorrected` ASC + `createdAt` DESC

Replace the contents of `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "foodLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "nutritionSource", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "foodLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "nutrientsCorrected", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Step 2: Deploy indexes**

```bash
firebase deploy --only firestore:indexes
```

Note: Index creation takes a few minutes. Queries will work without indexes locally but may fail in production until indexes are built.

**Step 3: Commit**

```bash
git add firestore.indexes.json
git commit -m "feat: add Firestore composite indexes for correction memory queries"
```

---

### Task 6: End-to-End Verification

**Step 1: Restart dev servers**

Kill and restart `npm run dev:local` to pick up all backend changes.

**Step 2: Test the full flow**

1. Open http://localhost:3500, go to Chat
2. Log a food (e.g., "I had a Barebells protein bar") — should use USDA or ai_estimate
3. Edit that food log's protein to a different value (e.g., change from 20g to 16g) — should set `nutrientsCorrected: true`
4. Log the same food again (e.g., "I had another Barebells protein bar") — this time `lookupNutrition` should return `source: "user_history"` with the corrected 16g protein
5. Verify Firestore shows `nutritionSource: "user_history"` on the new entry

**Step 3: Test edge cases**

1. Log a food that has no history (brand new food) — should fall through to USDA as before
2. Log a food with a similar but different name — AI should judge whether it's the same food
3. Edit a food's meal type only (no nutrient change) — should NOT set `nutrientsCorrected`

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during correction memory verification"
```
