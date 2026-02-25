# Correction Memory — Design

## Goal

When logging food, Kalli checks the user's past logs for authoritative nutrition data before calling USDA. User corrections, nutrition label scans, and USDA-verified entries are remembered and reused automatically.

## Problem

Today, if a user corrects "Barebells Banana Caramel" from 20g to 16g protein, Kalli forgets next time and estimates 20g again. There's no mechanism to learn from past corrections or reuse authoritative data.

## Design

### Approach: Bake user history into `lookupNutrition`

No new AI tool. The existing `lookupNutrition` tool gains a user history check as its first step. This adds zero extra AI round-trips and actually reduces latency when history hits (skips USDA API call).

### Lookup priority (inside `lookupNutrition`)

```
1. User history (Firestore) — corrected entries, past labels, past USDA, past user_input
2. USDA API
3. Common foods (hardcoded fallback)
4. Return failure → AI uses ai_estimate
```

### Nutrition source priority (for `logFood`)

```
1. nutrition_label — photo of a nutrition label (current message)
2. user_input — user provided macros in this message
3. user_history — from lookupNutrition user history check
4. usda — from lookupNutrition USDA search
5. common_foods — from lookupNutrition fallback
6. ai_estimate — last resort (lookupNutrition returned success: false)
```

### New `nutrientsCorrected` flag

The existing `corrected: true` flag fires on ANY update (meal change, name fix, etc.). We need a flag that only fires when nutrition values actually changed.

**Field:** `nutrientsCorrected: true` on food log documents.

**Set when:** An update includes any of `calories`, `protein`, `carbs`, `fat`.

**Set in:**
- `backend/src/agents/agentTools.js` → `updateFoodLog`
- `backend/src/controllers/foodController.js` → `updateLog`

**Detection logic:**
```js
const NUTRIENT_KEYS = ['calories', 'protein', 'carbs', 'fat'];
if (NUTRIENT_KEYS.some(k => k in cleanUpdates)) {
    cleanUpdates.nutrientsCorrected = true;
}
```

### Frontend: only send changed fields

`FoodEditModal` currently sends all fields on every save. Change `handleSubmit` to diff against `initialData` and only send fields that actually changed. This prevents false positives on `nutrientsCorrected`.

```js
const changes = {};
const numericKeys = ['quantity', 'calories', 'protein', 'carbs', 'fat'];
for (const [key, val] of Object.entries(formData)) {
    const newVal = numericKeys.includes(key) ? Number(val) : val;
    if (newVal !== initialData[key]) changes[key] = newVal;
}
if (Object.keys(changes).length > 0) onSave(changes);
```

### User history query (inside `lookupNutrition`)

**Firestore query strategy:**

Can't do OR across different fields in one Firestore query, so run two parallel queries and merge:

1. `nutritionSource IN ['usda', 'nutrition_label', 'user_input']` ordered by `createdAt` desc, limit 10
2. `nutrientsCorrected == true` ordered by `createdAt` desc, limit 10

Merge results, dedupe by doc ID, filter client-side by name match (case-insensitive substring of `foodName` against `name` field), return top 3.

**Returned format:**
```js
{
  success: true,
  source: 'user_history',
  data: {
    name: "Barebells Banana Caramel protein bar",
    calories: 200, protein: 16, carbs: 18, fat: 7,
    quantity: 1, unit: "bar",
    originalSource: "nutrition_label",  // what the data originally came from
    corrected: true,                    // whether user corrected nutrients
    date: "2026-02-20"                  // when it was logged
  },
  alternatives: [...]  // other matches if any
}
```

**Performance:** Firestore subcollection query ~50ms. When history hits, USDA API call (~200-500ms) is skipped entirely. When history misses, adds ~50ms overhead. Multiple food items are parallelized (AI calls lookupNutrition for each food concurrently).

### System prompt changes

Update nutrition source tracking section and add specificity instructions:

- Call `lookupNutrition` for every food — it now checks user history automatically.
- `lookupNutrition` may return `source: "user_history"` — use `nutritionSource: "user_history"` when logging.
- **Name specificity matters** — "Barebells Banana Caramel" is NOT "Barebells Salted Caramel". Only use a history match if the food is genuinely the same item.
- **Scale by quantity** — if history shows 1 bar = 200 cal and user had 2 bars, log 400 cal. If history shows 5oz pasta = 275 cal and user had 2oz, scale proportionally.
- **Corrected entries are most trusted** — the user explicitly fixed these values.
- If no history match is specific enough, the tool falls through to USDA automatically.

### New `nutritionSource` enum value

Add `"user_history"` to the `nutritionSource` enum in the `logFood` tool definition. This tracks how often historical data is reused.

### Firestore indexes

Composite indexes needed on `users/{uid}/foodLogs`:
- `nutritionSource` ASC + `createdAt` DESC
- `nutrientsCorrected` ASC + `createdAt` DESC

## Files to modify

| File | Change |
|------|--------|
| `backend/src/agents/agentTools.js` | Add history query to `lookupNutrition`, add `nutrientsCorrected` to `updateFoodLog`, add `user_history` to `logFood` enum |
| `backend/src/controllers/foodController.js` | Add `nutrientsCorrected` detection to `updateLog` |
| `backend/src/services/geminiService.js` | Update system prompt with new priority and specificity instructions |
| `frontend/src/components/common/FoodEditModal.jsx` | Only send changed fields in `handleSubmit` |

## What we're NOT building

- No separate "corrections" collection — reuses existing foodLogs
- No fuzzy matching infrastructure — AI handles name similarity judgment
- No caching layer — Firestore queries are fast enough
- No retroactive backfill of `nutrientsCorrected` on old data
- No uncorrected `ai_estimate` or `common_foods` entries in history results
