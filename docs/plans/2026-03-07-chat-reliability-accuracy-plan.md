# Chat Reliability & Accuracy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix tool-calling loop exhaustion, improve nutrition matching accuracy, and eliminate empty chat responses.

**Architecture:** Incremental backend-only changes to 4 files — no new endpoints, no frontend changes, no data model changes. All changes are backward-compatible.

**Tech Stack:** Node.js, Express, Gemini 3 Flash (@google/genai), Firebase Firestore

**Design doc:** `docs/plans/2026-03-07-chat-reliability-accuracy-design.md`

---

### Task 1: Token Scoring Utility

Shared scoring function used by both lookupNutrition and searchFoodLogs.

**Files:**
- Modify: `backend/src/agents/agentTools.js:1-11` (add utility functions at top of file, after imports)

**Step 1: Add token scoring and composite scoring functions**

Add after the `const ALLOWED_UPDATE_KEYS` line (line 11) and before `const toolDeclarations`:

```javascript
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
    const recencyScore = Math.max(0, 1 - (daysAgo / 90));

    // Frequency: normalized against the most frequent item in candidates
    const frequencyScore = maxFrequency > 0 ? frequencyCount / maxFrequency : 0;

    return (tokenScore * 0.7) + (recencyScore * 0.15) + (frequencyScore * 0.15);
};

const validateNutrients = (item) => {
    const warnings = [];
    if (item.calories < 0 || item.calories > 3000) warnings.push(`${item.name}: calories (${item.calories}) outside expected range 0-3000`);
    if (item.protein < 0 || item.protein > 300) warnings.push(`${item.name}: protein (${item.protein}g) outside expected range 0-300g`);
    if (item.carbs < 0 || item.carbs > 500) warnings.push(`${item.name}: carbs (${item.carbs}g) outside expected range 0-500g`);
    if (item.fat < 0 || item.fat > 200) warnings.push(`${item.name}: fat (${item.fat}g) outside expected range 0-200g`);

    // Calories below macro sum by more than 10% is physically impossible
    const macroSum = (item.protein * 4) + (item.carbs * 4) + (item.fat * 9);
    if (macroSum > 0 && item.calories < macroSum * 0.9) {
        warnings.push(`${item.name}: stated ${item.calories} cal but macros suggest ~${Math.round(macroSum)} cal. Values were saved but may need correction.`);
    }
    return warnings;
};
```

**Step 2: Verify the server starts without errors**

Run: `cd backend && node -e "require('./src/agents/agentTools');" && echo "OK"`
Expected: "OK" with no errors

**Step 3: Commit**

```bash
git add backend/src/agents/agentTools.js
git commit -m "feat: add token scoring, composite scoring, and nutrient validation utilities"
```

---

### Task 2: lookupNutrition — Improved Matching

Replace substring matching with composite token-overlap scoring and increase candidate limits.

**Files:**
- Modify: `backend/src/agents/agentTools.js:481-559` (lookupNutrition function)

**Step 1: Update Firestore query limits from 10 to 50**

Change lines 495-496 and 500-501: both `.limit(10)` become `.limit(50)`.

**Step 2: Replace substring matching with composite scoring**

Replace lines 516-520 (the `lowerFood` and `matches` filter) with:

```javascript
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
```

**Step 3: Update the logging to include score info**

Update the log line at ~line 524 to include `score: best.composite, tokenScore: best.tokenScore`:

```javascript
                getLogger().info({ action: 'tool.lookupNutrition', foodName, source: 'user_history',
                    matchedName: best.name, corrected: best.nutrientsCorrected || false,
                    score: best.composite?.toFixed(3), tokenScore: best.tokenScore?.toFixed(3)
                }, 'Nutrition lookup: user_history match');
```

**Step 4: Verify the server starts**

Run: `cd backend && node -e "require('./src/agents/agentTools');" && echo "OK"`
Expected: "OK"

**Step 5: Commit**

```bash
git add backend/src/agents/agentTools.js
git commit -m "feat: improve lookupNutrition matching with token scoring and composite ranking"
```

---

### Task 3: searchFoodLogs — Full Nutrition, daysBack, Token Ranking

**Files:**
- Modify: `backend/src/agents/agentTools.js:123-139` (searchFoodLogs tool declaration)
- Modify: `backend/src/agents/agentTools.js:601-667` (searchFoodLogs function)

**Step 1: Update tool declaration — add daysBack parameter and update description**

Replace the searchFoodLogs tool declaration (lines 123-140) with:

```javascript
    {
        name: 'searchFoodLogs',
        description: 'Search past food logs. Returns full nutrition data for each match. Use daysBack to search across multiple days (e.g., daysBack: 7 for the last week). Use this BEFORE updateFoodLog/deleteFoodLog to find logIds, or when the user references a past meal to re-log.',
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
                },
                daysBack: {
                    type: 'number',
                    description: 'Number of days back to search (0 = today only). Defaults to 0. Max 30.'
                }
            },
            required: ['query']
        }
    },
```

**Step 2: Rewrite searchFoodLogs function**

Replace the entire searchFoodLogs function (lines 601-667) with:

```javascript
const searchFoodLogs = async (args, userId, userTimezone) => {
    let { query, date, daysBack } = args;

    if (!date) {
        date = getTodayStr(userTimezone);
    }

    // Cap daysBack at 30
    daysBack = Math.min(Math.max(daysBack || 0, 0), 30);

    try {
        let snapshot;
        const logsRef = db.collection('users').doc(userId).collection('foodLogs');

        if (daysBack > 0) {
            // Range query: date >= startDate && date <= endDate
            const endDate = date;
            const startDateObj = parseLocalDate(date);
            startDateObj.setDate(startDateObj.getDate() - daysBack);
            const startDate = toDateStr(startDateObj);

            snapshot = await logsRef
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .get();
        } else {
            snapshot = await logsRef
                .where('date', '==', date)
                .get();
        }

        if (snapshot.empty) {
            return { success: true, data: { count: 0, matches: [], message: `No food logs found${daysBack > 0 ? ` in the last ${daysBack} days` : ` for ${date}`}` } };
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
                    date: daysBack > 0 ? undefined : date,
                    matches: logs.map(mapMatch)
                }
            };
        }

        // Score and rank all logs by token overlap — no threshold, return all ranked
        const scored = logs
            .map(log => {
                const nameScore = log.name ? scoreTokenMatch(query, log.name) : 0;
                const mealScore = log.meal ? scoreTokenMatch(query, log.meal) : 0;
                const score = Math.max(nameScore, mealScore);
                return { ...log, score };
            })
            .sort((a, b) => b.score - a.score);

        // Return all matches, ranked by relevance (even score 0 items at the bottom)
        return {
            success: true,
            data: {
                count: scored.length,
                date: daysBack > 0 ? undefined : date,
                matches: scored.map(mapMatch)
            }
        };
    } catch (error) {
        getLogger().error({ err: error }, 'Error searching food logs');
        return { success: false, error: 'Failed to search logs' };
    }
};
```

**Step 3: Add parseLocalDate and toDateStr imports**

At line 8, update the dateUtils import to include `parseLocalDate` and `toDateStr`:

```javascript
const { getTodayStr, parseLocalDate, toDateStr } = require('../utils/dateUtils');
```

**Step 4: Verify the server starts**

Run: `cd backend && node -e "require('./src/agents/agentTools');" && echo "OK"`
Expected: "OK"

**Step 5: Commit**

```bash
git add backend/src/agents/agentTools.js
git commit -m "feat: searchFoodLogs with full nutrition data, daysBack, and token-scored ranking"
```

---

### Task 4: logFood — Nutrient Validation

Add warn-but-save validation to logFood.

**Files:**
- Modify: `backend/src/agents/agentTools.js:370-428` (logFood function, between dedup check and batch write)

**Step 1: Add validation between dedup check and batch write**

After `items = newItems;` (line 372) and before `const batch = db.batch();` (line 374), insert:

```javascript
    // Nutrient validation — warn but always save
    const nutrientWarnings = [];
    for (const item of items) {
        const itemWarnings = validateNutrients(item);
        nutrientWarnings.push(...itemWarnings);
    }
    if (nutrientWarnings.length > 0) {
        getLogger().warn({ action: 'tool.logFood.nutrientValidation', warnings: nutrientWarnings }, 'Nutrient validation warnings');
    }
```

**Step 2: Include warnings in the tool response**

After the `result` object is built (~line 471), before the `newBadges` check, add:

```javascript
    if (nutrientWarnings.length > 0) {
        result.warnings = nutrientWarnings;
    }
```

**Step 3: Verify the server starts**

Run: `cd backend && node -e "require('./src/agents/agentTools');" && echo "OK"`
Expected: "OK"

**Step 4: Commit**

```bash
git add backend/src/agents/agentTools.js
git commit -m "feat: add nutrient validation (warn-but-save) to logFood"
```

---

### Task 5: USDA Retry with Simplified Query

**Files:**
- Modify: `backend/src/services/nutritionService.js:47-73` (searchFoods function)

**Step 1: Add retry logic on 500/504 responses**

Replace the `searchFoods` function (lines 47-73) with:

```javascript
const searchFoods = async (query, limit = 5) => {
    const doSearch = async (searchQuery) => {
        // Sanitize: strip parentheses (cause USDA 400 when unmatched)
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
        // Retry on 500/504 with simplified query (strip quantities, units, fractions)
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
```

**Step 2: Verify the server starts**

Run: `cd backend && node -e "require('./src/services/nutritionService');" && echo "OK"`
Expected: "OK"

**Step 3: Commit**

```bash
git add backend/src/services/nutritionService.js
git commit -m "feat: add USDA retry with simplified query on 500/504 errors"
```

---

### Task 6: Context Cache Invalidation on Profile Update

**Files:**
- Modify: `backend/src/agents/agentTools.js:836-913` (updateUserProfile function)
- Modify: `backend/src/agents/agentTools.js:1-8` (imports)

**Step 1: Add invalidateContextCache import**

At the top of the file, after the existing imports (around line 7), add:

```javascript
const { invalidateContextCache } = require('../services/geminiService');
```

**Note:** Check for circular dependency issues. `geminiService` already imports from `agentTools`. If this causes a circular dependency, use lazy require inside the function instead:

```javascript
// Inside updateUserProfile, after the Firestore write:
const { invalidateContextCache } = require('../services/geminiService');
invalidateContextCache();
```

**Step 2: Call invalidateContextCache after successful profile update**

In the `updateUserProfile` function, after the `await db.collection('users').doc(userId).set(updateData, { merge: true });` line (~line 893), add:

```javascript
    // Invalidate context cache so next chat picks up updated biometrics/goals
    try {
        const { invalidateContextCache } = require('../services/geminiService');
        invalidateContextCache();
    } catch (err) {
        getLogger().warn({ err }, 'Failed to invalidate context cache after profile update');
    }
```

**Step 3: Verify the server starts**

Run: `cd backend && node -e "require('./src/agents/agentTools');" && echo "OK"`
Expected: "OK"

**Step 4: Commit**

```bash
git add backend/src/agents/agentTools.js
git commit -m "fix: invalidate context cache when user updates profile"
```

---

### Task 7: Tool-Calling Loop Redesign

This is the largest change. Modifies both the text and image processing loops in geminiService.js.

**Files:**
- Modify: `backend/src/services/geminiService.js:17` (constants)
- Modify: `backend/src/services/geminiService.js:340-398` (processMessage loop)
- Modify: `backend/src/services/geminiService.js:478-534` (processImageMessage loop)

**Step 1: Replace constants and add research tool set**

Replace line 17 (`const MAX_TOOL_ITERATIONS = 10;`) with:

```javascript
const RESEARCH_TOOL_CAP = 15;
const MAX_TOTAL_ITERATIONS = 25;
const RESEARCH_TOOLS = new Set(['lookupNutrition', 'searchFoodLogs', 'getUserGoals']);
const ACTION_TOOLS = ['logFood', 'getDailySummary', 'updateFoodLog', 'deleteFoodLog', 'updateUserProfile', 'triggerWeeklyReview'];
```

**Step 2: Add helper functions for budget awareness and fallback**

Add after the `buildChatHistory` function (after line 284) and before `processMessage`:

```javascript
const getBudgetMessage = (researchCalls, totalIterations) => {
    if (researchCalls >= RESEARCH_TOOL_CAP) {
        return 'Research limit reached. Only action tools (logFood, updateFoodLog, deleteFoodLog, getDailySummary) are available. Proceed with the data you have.';
    }
    if (totalIterations >= 20) {
        return `You've used ${totalIterations} of ${MAX_TOTAL_ITERATIONS} total tool calls. Wrap up and respond to the user.`;
    }
    if (researchCalls >= 13) {
        return `${RESEARCH_TOOL_CAP - researchCalls} research call(s) remaining. Use logFood now with your best estimates for any remaining items.`;
    }
    if (researchCalls >= 10) {
        return `You've used ${researchCalls} of ${RESEARCH_TOOL_CAP} research tool calls. Prioritize logging with the data you have.`;
    }
    return null;
};

const getEffectiveConfig = (baseConfig, researchCalls, totalIterations) => {
    if (totalIterations >= MAX_TOTAL_ITERATIONS) {
        // Force text-only response
        return {
            ...baseConfig,
            toolConfig: { functionCallingConfig: { mode: 'NONE' } }
        };
    }
    if (researchCalls >= RESEARCH_TOOL_CAP) {
        // Restrict to action tools only
        return {
            ...baseConfig,
            toolConfig: {
                functionCallingConfig: {
                    mode: 'AUTO',
                    allowedFunctionNames: ACTION_TOOLS
                }
            }
        };
    }
    return baseConfig;
};

const buildFallbackResponse = (responseText, foodLog, loopExhausted) => {
    if (responseText) return responseText;

    if (foodLog && foodLog.items?.length > 0) {
        const itemNames = foodLog.items.map(i => i.name).join(', ');
        const cal = Math.round(foodLog.totalCalories || 0);
        if (loopExhausted) {
            return `I logged ${itemNames} (${cal} cal) but hit my processing limit. Let me know if anything's missing.`;
        }
        return `Done! I logged ${itemNames} (${cal} cal total).`;
    }

    if (loopExhausted) {
        return "I couldn't complete this request — try breaking it into smaller messages.";
    }

    return "Sorry, I had trouble generating a response. Could you try that again?";
};
```

**Step 3: Rewrite the processMessage tool-calling loop**

Replace the tool-calling loop in processMessage (lines 344-398) with:

```javascript
        let toolsUsed = [];
        let foodLog = null;
        let responseText = getResponseText(result);
        let functionCalls = getFunctionCalls(result);
        const lookupCache = new Map();
        const completedActions = [];

        let researchCalls = 0;
        let totalIterations = 0;

        while (functionCalls.length > 0 && totalIterations < MAX_TOTAL_ITERATIONS) {
            totalIterations++;
            const functionResponses = [];

            for (const call of functionCalls) {
                // Track research calls
                if (RESEARCH_TOOLS.has(call.name)) {
                    researchCalls++;
                }

                getLogger().info({ tool: call.name, iteration: totalIterations, researchCalls, totalIterations }, 'Executing tool');
                toolsUsed.push(call.name);

                const toolResult = await executeTool(call.name, call.args, userId, userTimezone, idempotencyKey, { lookupCache });

                if (call.name === 'logFood' && toolResult.success) {
                    foodLog = mergeFoodLogs(foodLog, toolResult.data);
                    completedActions.push({
                        tool: 'logFood',
                        items: toolResult.data.items?.map(i => i.name) || [],
                        totalCalories: toolResult.data.totalCalories,
                        meal: toolResult.data.meal,
                        date: toolResult.data.date
                    });
                }

                // Include completed actions context on errors to prevent re-logging
                if (!toolResult.success && completedActions.length > 0) {
                    toolResult.previouslyCompleted = completedActions;
                    toolResult.guidance = 'These items were already logged successfully. Do not re-log them.';
                }

                functionResponses.push({
                    name: call.name,
                    response: toolResult
                });
            }

            // Inject budget awareness message if approaching limits
            const budgetMsg = getBudgetMessage(researchCalls, totalIterations);
            const toolResponseParts = functionResponses.map(fr => ({
                functionResponse: {
                    name: fr.name,
                    response: budgetMsg
                        ? { ...fr.response, _budgetWarning: budgetMsg }
                        : fr.response
                }
            }));

            // Get effective config based on budget state
            const effectiveConfig = getEffectiveConfig(config, researchCalls, totalIterations);

            result = await genAI.models.generateContent({
                model: modelName,
                contents: [
                    ...contents,
                    { role: 'model', parts: result.candidates[0].content.parts },
                    { role: 'user', parts: toolResponseParts }
                ],
                config: effectiveConfig
            });

            responseText = getResponseText(result);
            functionCalls = getFunctionCalls(result);
        }

        const loopExhausted = totalIterations >= MAX_TOTAL_ITERATIONS ||
            (researchCalls >= RESEARCH_TOOL_CAP && functionCalls.length > 0);

        if (loopExhausted) {
            getLogger().warn({ totalIterations, researchCalls, toolsUsed }, 'Tool-calling loop exhausted');
        }

        responseText = buildFallbackResponse(responseText, foodLog, loopExhausted);

        return {
            text: responseText,
            model: modelName,
            tokensUsed: result.usageMetadata?.totalTokenCount,
            toolsUsed,
            foodLog
        };
```

**Step 4: Apply same loop changes to processImageMessage**

Replace the tool-calling loop in processImageMessage (lines 480-534) with the exact same pattern as Step 3, but using `getImgResponseText`/`getImgFunctionCalls` instead of `getResponseText`/`getFunctionCalls`, `imgConfig` instead of `config`, and adding `source: 'photo'` to the executeTool options.

The loop structure is identical — copy the pattern from Step 3 with these variable name substitutions:
- `getResponseText` → `getImgResponseText`
- `getFunctionCalls` → `getImgFunctionCalls`
- `config` → `imgConfig`
- `executeTool(..., { lookupCache })` → `executeTool(..., { source: 'photo', lookupCache })`

**Step 5: Verify the server starts**

Run: `cd backend && npm run dev:backend` (start and verify no startup errors, then kill)

**Step 6: Commit**

```bash
git add backend/src/services/geminiService.js
git commit -m "feat: redesign tool-calling loop with research cap, budget awareness, and fallback responses"
```

---

### Task 8: System Prompt Changes

**Files:**
- Modify: `backend/src/services/geminiService.js:52-216` (BASE_SYSTEM_PROMPT)

**Step 1: Add "Tool Call Efficiency" section**

After the "## Coaching Behaviors" section (around line 138 after the weekly review bullet), add:

```
## Tool Call Efficiency
- You have a budget of 15 research tool calls (lookupNutrition, searchFoodLogs, getUserGoals) per message. Action tools (logFood, getDailySummary, updateFoodLog, deleteFoodLog) are always available and don't count against this limit.
- When logging a multi-item meal, you can call lookupNutrition for each item simultaneously in the same turn — you don't have to wait for one result before calling the next.
- If you're running low on research calls, proceed with logFood using your best estimates rather than searching more.
- If lookupNutrition returns no match for an item, use ai_estimate and move on. Do not rephrase and retry the same food.
```

**Step 2: Update "Referencing Previous Meals" section**

Find the "## Referencing Previous Meals" section. Add this bullet at the end:

```
- When the user references a past meal ("same as yesterday", "what I had last Tuesday", "leftovers"), use searchFoodLogs with daysBack to find it. The results include full nutrition data — copy those values directly into logFood. Do NOT call lookupNutrition for items you already found via searchFoodLogs.
```

**Step 3: Resolve conflicting instructions in "Important Rules"**

Find "Be precise with nutrition estimates." in the Important Rules section. After the existing bullet about lookupNutrition, add:

```
- lookupNutrition already checks your past corrected entries and authoritative logs before querying USDA — you do not need to call searchFoodLogs first to verify. Only use searchFoodLogs when you need a logId (for updates/deletes) or when the user explicitly references a past meal to re-log.
```

**Step 4: Invalidate context cache**

Since the system prompt changed, the cached context is now stale. The cache will auto-refresh on next cold start (TTL-based), but to be safe, note that a deploy will create fresh instances. No code change needed here — the cache is lazy-initialized per instance.

**Step 5: Commit**

```bash
git add backend/src/services/geminiService.js
git commit -m "feat: update system prompt with tool efficiency, search/lookup clarity, and conflict resolution"
```

---

### Task 9: Gemini Configuration Fixes

**Files:**
- Modify: `backend/src/services/geminiService.js:457-470` (image maxOutputTokens)
- Modify: `backend/src/services/geminiService.js:833` (home greeting thinkingLevel)
- Modify: `backend/src/controllers/chatController.js:60` (chat history limit)

**Step 1: Unify image maxOutputTokens to 8192**

Find both `maxOutputTokens: 4096` occurrences in the image config (~lines 459 and 466). Change both to `maxOutputTokens: 8192`.

**Step 2: Change home greeting thinkingLevel to MINIMAL**

Find line 833: `thinkingConfig: { thinkingLevel: 'LOW' }` in generateHomeGreeting. Change to:

```javascript
thinkingConfig: { thinkingLevel: 'MINIMAL' }
```

**Step 3: Add explicit thinkingLevel to weekly review**

Find the weekly review Gemini call. Search for `generateWeeklyReview` or the weekly review generation call in `weeklyReviewService.js`. Add `thinkingConfig: { thinkingLevel: 'MEDIUM' }` to its config if not already present.

Run: `grep -n 'thinkingConfig\|generateContent' backend/src/services/weeklyReviewService.js` to find the exact location.

**Step 4: Increase chat history limit from 20 to 30**

In `backend/src/controllers/chatController.js` line 60, change `.limit(20)` to `.limit(30)`.

**Step 5: Verify the server starts**

Run: `cd backend && npm run dev:backend` (start and verify, then kill)

**Step 6: Commit**

```bash
git add backend/src/services/geminiService.js backend/src/controllers/chatController.js backend/src/services/weeklyReviewService.js
git commit -m "fix: unify maxOutputTokens, set MINIMAL greeting thinking, increase chat history to 30"
```

---

### Task 10: Express Rate-Limit IPv6 Fix

**Files:**
- Modify: `backend/src/index.js:52-59` (rate limiter config)

**Step 1: Update the keyGenerator to use ipKeyGenerator**

Check if `express-rate-limit` exports `ipKeyGenerator`:

Run: `node -e "const rl = require('express-rate-limit'); console.log(typeof rl.ipKeyGenerator)"`

If available, replace the limiter config (lines 52-59) with:

```javascript
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'development' ? 500 : 200,
    keyGenerator: rateLimit.ipKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
```

If `ipKeyGenerator` is not available in the installed version, update the custom keyGenerator to validate IPv6:

```javascript
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'development' ? 500 : 200,
    keyGenerator: (req) => req.ip || 'unknown',
    validate: { ip: false },
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
```

**Step 2: Verify the server starts without the IPv6 warning**

Run: `cd backend && npm run dev:backend` (check logs for absence of the ValidationError)

**Step 3: Commit**

```bash
git add backend/src/index.js
git commit -m "fix: resolve express-rate-limit IPv6 validation warning"
```

---

### Task 11: Manual Integration Test

Start the dev server and test the changes end-to-end via the chat interface.

**Step 1: Start the dev environment**

Run: `npm run dev:local`

**Step 2: Test scenarios via the chat at http://localhost:3500**

Test these scenarios and verify behavior:

1. **Simple food log**: "I had 2 eggs for breakfast" — should lookupNutrition, logFood, getDailySummary without issues
2. **Multi-item meal**: "For lunch I had a turkey sandwich, chips, and a coke" — should batch lookupNutrition calls, log all items
3. **Past meal reference**: "Same breakfast as yesterday" — should use searchFoodLogs with daysBack, copy nutrition data directly without calling lookupNutrition
4. **Correction flow**: "Actually that sandwich was 450 calories, not 350" — should searchFoodLogs then updateFoodLog
5. **Photo log**: Send a photo of food — should identify, log with maxOutputTokens 8192
6. **Home greeting**: Navigate to home screen — should load greeting near-instantly (MINIMAL thinking)
7. **Check logs**: Verify no IPv6 warnings, no loop exhaustion, nutrient warnings appear when values are suspicious

**Step 3: Final commit — update design doc status**

```bash
git add -A
git commit -m "chore: complete chat reliability and accuracy improvements"
```
