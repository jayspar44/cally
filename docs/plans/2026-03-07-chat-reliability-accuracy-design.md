# Chat Reliability & Accuracy Improvements

**Date**: 2026-03-07
**Branch**: feature/chat-reliability
**Scope**: Backend-only changes to geminiService.js, agentTools.js, nutritionService.js, index.js

## Problem Statement

Production log analysis (March 2-7, 2026) revealed:
- 6 tool-calling loop exhaustions where food was never logged (foodLog: null)
- Model stuck alternating between searchFoodLogs and lookupNutrition without reaching logFood
- Empty/incomplete responses when loop exhausts
- USDA API failures (6 occurrences) with no retry
- Inaccurate nutrition matching from one-directional substring matching
- Conflicting system prompt instructions causing unnecessary tool calls

## Changes

### 1. Tool-Calling Loop Redesign

**File**: `geminiService.js`

Replace single `MAX_TOOL_ITERATIONS = 10` counter with two separate tracking mechanisms:

| Counter | Cap | Tracks |
|---|---|---|
| `researchCalls` | 15 | lookupNutrition, searchFoodLogs, getUserGoals |
| `totalIterations` | 25 | All tool calls (safety net) |

**Research tools**: lookupNutrition, searchFoodLogs, getUserGoals
**Action tools** (always available, uncapped): logFood, getDailySummary, updateFoodLog, deleteFoodLog, updateUserProfile, triggerWeeklyReview

**Budget awareness injection** — append system note to tool responses at thresholds:

| Threshold | Injected message |
|---|---|
| researchCalls >= 10 | "You've used 10 of 15 research tool calls. Prioritize logging with the data you have." |
| researchCalls >= 13 | "2 research calls remaining. Use logFood now with your best estimates for any remaining items." |
| researchCalls >= 15 | "Research limit reached. Only action tools available." + restrict via allowedFunctionNames |
| totalIterations >= 20 | "You've used 20 of 25 total tool calls. Wrap up and respond to the user." |
| totalIterations >= 25 | Force NONE mode — text response only |

**Completed-action tracking**: Maintain `completedActions` array in the loop. After each successful logFood, record `{ items, totalCalories, meal, date }`. Include in tool responses on errors so the model knows what's already saved and doesn't duplicate.

**Empty response fallback** (after loop exits):

| Condition | Fallback message |
|---|---|
| foodLog exists + no text | "Done! I logged [items] ([cal] cal total)." |
| Loop exhausted + foodLog exists | "I logged [items] ([cal] cal) but hit my processing limit. Let me know if anything's missing." |
| Loop exhausted + no foodLog | "I couldn't complete this request -- try breaking it into smaller messages." |
| No text + no error + no foodLog | "Sorry, I had trouble generating a response. Could you try that again?" |

### 2. searchFoodLogs Improvements

**File**: `agentTools.js`

**A. Full nutrition data in results**

Add to each match in the response: `protein, carbs, fat, nutritionSource, corrected`

Eliminates the need to call lookupNutrition after searching — the model can copy values directly for "same as yesterday" requests.

**B. daysBack parameter**

New optional parameter on the tool declaration:
```
daysBack: { type: 'number', description: 'Number of days back to search (0 = today only). Defaults to 0.' }
```

Implementation: If daysBack > 0, query Firestore with `date >= startDate && date <= endDate` instead of `date == date`. Cap at 30 days.

**C. Token-overlap scoring for ranking**

Replace substring matching with Jaccard token-overlap scoring. No threshold — return all matches for the date(s), ranked by score descending. Best matches first, nothing hidden.

### 3. lookupNutrition Improvements

**File**: `agentTools.js`

**A. Token-overlap scoring with composite ranking**

Replace one-directional substring matching with Jaccard token-overlap scoring, minimum threshold 0.4.

Composite score for ranking:
```
finalScore = (tokenScore * 0.7) + (recencyScore * 0.15) + (frequencyScore * 0.15)
```

- tokenScore: Jaccard similarity (matching tokens / all unique tokens)
- recencyScore: 1.0 if logged today, linear decay to 0.0 at 90 days
- frequencyScore: count of same food name in candidates / max count across all candidates

Token scoring function (shared with searchFoodLogs):
```javascript
const scoreMatch = (searchName, candidateName) => {
    const searchTokens = new Set(searchName.toLowerCase().split(/\s+/));
    const candidateTokens = new Set(candidateName.toLowerCase().split(/\s+/));
    const allTokens = new Set([...searchTokens, ...candidateTokens]);
    const matching = [...searchTokens].filter(t => candidateTokens.has(t));
    return matching.length / allTokens.size;
};
```

**B. Increase candidate limits from 10 to 50** per query (both authoritative and corrected).

**C. USDA retry with simplified query**

On 500/504 from USDA API, retry once with quantities/units/fractions stripped:
```
"feta cheese crumbled 1/4 cup" -> "feta cheese"
```

One retry only, only if simplified query differs from original.

### 4. logFood Nutrient Validation

**File**: `agentTools.js`

Warn-but-save approach. Run validation before batch write, always save regardless.

**Checks:**
- Calories per item: 0-3000
- Protein: 0-300g
- Carbs: 0-500g
- Fat: 0-200g
- Calories below macro sum by more than 10%: `calories < (protein*4 + carbs*4 + fat*9) * 0.9`

**Behavior:**
- Warnings collected per item, included in tool response
- Items always saved regardless of warnings
- Warnings logged server-side for monitoring
- Example warning: "Scrambled eggs: stated 60 cal but macros suggest ~240 cal. Values were saved but may need correction."

No "above" check — calories above macro sum has legitimate explanations (alcohol, fiber).

### 5. System Prompt Changes

**File**: `geminiService.js`

**A. New "Tool Call Efficiency" section** (after "How You Work"):
> - You have a budget of 15 research tool calls (lookupNutrition, searchFoodLogs, getUserGoals) per message. Action tools (logFood, getDailySummary, updateFoodLog, deleteFoodLog) are always available and don't count against this limit.
> - When logging a multi-item meal, you can call lookupNutrition for each item simultaneously in the same turn -- you don't have to wait for one result before calling the next.
> - If you're running low on research calls, proceed with logFood using your best estimates rather than searching more.
> - If lookupNutrition returns no match for an item, use ai_estimate and move on. Do not rephrase and retry the same food.

**B. searchFoodLogs vs lookupNutrition clarity** (update "Referencing Previous Meals"):
> - When the user references a past meal ("same as yesterday", "what I had last Tuesday", "leftovers"), use searchFoodLogs with daysBack to find it. The results include full nutrition data -- copy those values directly into logFood. Do NOT call lookupNutrition for items you already found via searchFoodLogs.

**C. Resolve conflicting instructions** (update "Important Rules"):
> - lookupNutrition already checks your past corrected entries and authoritative logs before querying USDA -- you do not need to call searchFoodLogs first to verify. Only use searchFoodLogs when you need a logId (for updates/deletes) or when the user explicitly references a past meal to re-log.

### 6. Gemini Configuration Fixes

**File**: `geminiService.js`, `chatController.js`

| Path | thinkingLevel (current) | thinkingLevel (new) | maxOutputTokens (current) | maxOutputTokens (new) |
|---|---|---|---|---|
| Chat text | MEDIUM | **HIGH** | 8192 | **16384** |
| Chat image | MEDIUM | **HIGH** | 4096 | **16384** |
| Home greeting | LOW | **MINIMAL** | 1024 | **4096** |
| Insights summary | LOW | **MEDIUM** | (unset) | **4096** |
| Weekly review | (unset, defaults HIGH) | **MEDIUM** | 2048 | **4096** |

Chat history limit: 20 messages → **30 messages** (`chatController.js`)

**Note:** Update CLAUDE.md Gemini convention from "use `'MEDIUM'` for conversational/tool-calling" to "use `'HIGH'` for conversational/tool-calling".

### 7. Context Cache Invalidation

**File**: `agentTools.js`

Call `invalidateContextCache()` when `updateUserProfile` is called, so the next chat message picks up updated biometrics/goals. Currently only invalidated after weekly review.

### 8. Express Rate-Limit IPv6 Fix

**File**: `backend/src/index.js`

Use the `ipKeyGenerator` helper from `express-rate-limit` in the custom keyGenerator to eliminate 66 noisy log warnings per period.

## Files Modified

| File | Changes |
|---|---|
| `backend/src/services/geminiService.js` | Loop redesign, fallback templates, prompt changes, config fixes, chat history limit |
| `backend/src/agents/agentTools.js` | Token scoring, searchFoodLogs improvements, nutrient validation, cache invalidation |
| `backend/src/services/nutritionService.js` | USDA retry logic |
| `backend/src/index.js` | Rate-limit IPv6 fix |

## Out of Scope

- Saved Foods / Item Memory (separate feature)
- Confirmation preview cards (separate feature)
- Two-pass Gemini architecture
- Frontend changes
- Data model changes
