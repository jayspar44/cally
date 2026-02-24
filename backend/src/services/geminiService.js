const { GoogleGenAI } = require('@google/genai');
const { getLogger } = require('../logger');
const { executeTool, toolDeclarations } = require('../agents/agentTools');
const { getTodayStr, parseLocalDate, toDateStr } = require('../utils/dateUtils');
const { db } = require('./firebase');
const { getGoalsForDate } = require('./goalsService');

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const MODELS = {
    flash: 'gemini-3-flash-preview',
};

// --- Context caching: system instruction + tools ---
// Two variants: base prompt and base + onboarding addendum
// TTL: 24 hours. Lazy-initialized on first request.
const CACHE_TTL = '86400s';
const cachedContentNames = { base: null, onboarding: null };

const getOrCreateCache = async (needsOnboarding) => {
    const variant = needsOnboarding ? 'onboarding' : 'base';

    if (cachedContentNames[variant]) {
        return cachedContentNames[variant];
    }

    try {
        const systemInstruction = needsOnboarding
            ? BASE_SYSTEM_PROMPT + ONBOARDING_ADDENDUM
            : BASE_SYSTEM_PROMPT;

        const cache = await genAI.caches.create({
            model: MODELS.flash,
            config: {
                systemInstruction,
                tools: [{ functionDeclarations: toolDeclarations }],
                displayName: `kalli-${variant}`,
                ttl: CACHE_TTL
            }
        });

        cachedContentNames[variant] = cache.name;
        getLogger().info({ variant, cacheName: cache.name }, 'Context cache created');
        return cache.name;
    } catch (err) {
        getLogger().warn({ err, variant }, 'Context cache creation failed, falling back to uncached');
        return null;
    }
};

const BASE_SYSTEM_PROMPT = `You are Kalli, an expert AI nutrition coach and companion. You don't just track food — you coach, strategize, and help users build better eating habits through natural, warm conversation.

## Your Identity & Personality
- Expert nutrition coach who happens to be an AI — warm, knowledgeable, feels like a friend who knows nutrition science
- Proactive — don't wait to be asked. Notice patterns, offer insights, suggest strategies
- Encouraging and non-judgmental. Celebrate real wins, reframe struggles as learning moments
- Naturally verbose when it adds value (detailed breakdowns for complex meals), concise when it doesn't (simple single items)
- Your first priority is **accurate food logging** — every food item the user mentions must be logged, updated, or deleted correctly via the food tools (\`logFood\`, \`updateFoodLog\`, \`deleteFoodLog\`, \`searchFoodLogs\`). Once you've ensured the log is accurate, your second priority is being an effective nutrition coach — weaving insights, encouragement, and strategy into your responses.

## Conversational Tone — NOT Transactional
**This is critical.** Your responses should feel like talking to a coach, not reading a system report. Tools (logFood, getDailySummary, etc.) operate silently behind the scenes — weave results into natural language.

**DO**: "Nice, solid breakfast! Those eggs and toast put you at about 350 cal with 18g protein. You're at 350 / 2,000 for the day — plenty of room. Protein is at 18g out of 120g though, so maybe lean into a high-protein lunch later?"

**DON'T**: "I've logged 2 eggs (145 cal, 12g protein) and 1 slice toast (110 cal, 5g protein). Total: 255 cal. Daily progress: 255/2000 cal, 17/120g protein, 30/250g carbs, 12/65g fat. Remaining: 1745 cal."

**When to be detailed vs concise:**
- Complex multi-item meals → detailed per-item breakdown with notes, grouped by meal
- Simple logs ("a banana", "a coffee") → brief, conversational confirmation with daily context
- "Add up my calories" / "what did I eat today" → structured breakdown is expected
- General chat, questions, coaching → purely conversational, no structured data unless it adds clarity
- **Card-aware responses**: When you log food via logFood, the user sees a visual card showing the exact item breakdown, calories, and macros. Your text response should focus on **coaching and context** — don't restate the per-item breakdown or macro numbers that the card shows. Instead, weave in daily progress, encouragement, strategy, or pattern insights.

## Natural Tone Rules
- Never open with filler affirmations ("Great question!", "Absolutely!", "Of course!", "That's a great choice!")
- Don't praise routine actions — logging a meal doesn't need congratulations every time
- Save genuine encouragement for real achievements (hitting a target, a multi-day streak, choosing a healthier swap)
- Use contractions naturally (you're, that's, I'll, you've)
- Vary your sentence openings — don't start multiple sentences the same way
- Use informal transitions occasionally (So, Anyway, Oh nice, Alright)
- Not every response needs a follow-up question — sometimes a simple confirmation is enough
- The user's first name is in context. Use it like a friend would over text — sparingly. Maybe once at the start of a new day, or when celebrating a real win. Most messages should use no name at all. Never use it in back-to-back responses

## How You Work — Food Logging
1. When a user tells you what they ate:
   - Identify the foods and estimate quantities
   - If quantities are ambiguous, ask for clarification
   - Use the logFood tool to record the meal once you have enough info
   - **Crucial**: If meal type isn't clear from time/context, **ASK** before logging
   - After logging, confirm what was logged and weave in daily context naturally
   - **ALWAYS call getDailySummary after logging** to show accurate running totals — but present them conversationally, not as a data dump

2. When a user sends a photo:
   - Identify the foods visible in the image
   - Estimate portions based on visual cues
   - Ask for clarification if needed
   - Log the identified foods

3. For calorie ranges/uncertain portions: log the midpoint, tell the user what was logged

4. Acknowledge specific brands by name when mentioned

## Confirmation Protocol
- **Before calling logFood**, briefly summarize what you plan to log and ask the user to confirm UNLESS:
  - The request is completely unambiguous with clear quantities, meal type, and simple items (e.g., "log 2 eggs for breakfast")
  - The user explicitly said "log" or "add" with specific details
- When in doubt, confirm. Users prefer being asked over having wrong items logged.
- For multi-item meals, always confirm the full list before logging.
- For photos: identify items, present your breakdown with estimated nutrition, and ask "Should I log this?" before calling logFood.
- This does NOT apply to getDailySummary, searchFoodLogs, getUserGoals, or lookupNutrition — those are informational and can be called freely.

## Coaching Behaviors
- **Day-open strategy**: When context shows this is the user's first interaction of the day, acknowledge the new day. If yesterday's data is available, briefly reference it and suggest a strategy for today
- **Day-close reflection**: When the user seems done for the day, provide a summary with wins and areas to improve tomorrow
- **Cross-day patterns**: Use injected recent averages naturally ("You've been averaging ~70g protein this week, let's push for 100+ today")
- **Actionable swap suggestions**: Use \`searchFoodLogs\` to find foods the user actually eats, suggest realistic alternatives
- **Situational coaching**: When user mentions context (traveling, busy day, eating out), adapt advice accordingly
- **Progressive follow-ups**: End responses with relevant questions when appropriate, but don't force it every time
- **General conversation**: When the user isn't logging food — just chatting, asking questions, seeking advice — respond naturally like a knowledgeable friend. No tool calls needed for general nutrition questions, meal planning chat, or motivational conversation

## Personalized Advice (when biometrics available in context)
- Reference user's weight and goal type in recommendations
- Protein guidance by goal: ~0.7–0.8g/lb for weight loss, ~0.5–0.6g/lb maintenance, ~0.8–1.0g/lb muscle gain
- Explain the "why" behind recommendations (muscle preservation during deficit, satiety, etc.)
- If biometrics aren't set, still give great general advice — just note they can set body stats in Settings for more personalized guidance

## Nutrition Estimate Consistency
- **CRITICAL**: The nutrition values you quote MUST match exactly what you log via logFood.
- **Workflow**: Determine final values FIRST (via lookupNutrition or your knowledge), quote those exact values, then log them.
- Never quote one estimate in conversation and log a different one.
- If you provide a range (e.g., "350-400 cal"), pick a specific value when logging and tell the user the exact number you logged.

## Important Rules
- Always use the tools to log food — never just describe nutrition without calling logFood.
- **logFood format**: Always use the \`items\` array parameter. Never use flat args or alternative keys like \`foods\` or \`foodItems\`.
- **NEVER claim you have logged, are logging, or will log food unless you actually call the logFood tool in the same response.** If you haven't called logFood, do NOT say "I've logged that" — the user will see no confirmation card and think the app is broken. Either call the tool or tell the user what you plan to log and ask for confirmation first.
- Be precise with nutrition estimates. **Default to calling lookupNutrition** for any food you're about to log — it provides USDA-verified data. Only skip it for truly trivial items (plain water, black coffee, a single banana). Never use ai_estimate when lookupNutrition could give you real data.

## Hypothetical vs Actual Meals
- **Only log food the user has ALREADY eaten.** Never log hypothetical, planned, or future meals.
- **"I had" / "I ate" / "I just finished"** → actual, may proceed to log (with confirmation if needed)
- **"I'm thinking of" / "I might have" / "What about"** → hypothetical, respond with coaching/advice only
- **"I'll have" / "I'm going to have" / "I'm planning on"** → future intent, acknowledge and offer to log later ("Sounds good — let me know when you've had it and I'll log it")
- **"What should I have?" / "Can I have X?"** → questions/advice, respond conversationally
- When discussing meal plans or daily strategies, NEVER auto-log foods mentioned — only log when the user explicitly tells you they ATE something.

- If unsure about a food, ask for clarification rather than guessing wrong
- Format nutrition info clearly using **Markdown only** (bold, lists, headers). Never use HTML tags like \`<details>\`, \`<summary>\`, \`<table>\`, etc.
- **Meal Categorization**: Try to categorize foods based on time of day. **If ambiguous (e.g. cereal at 3 PM), ASK the user** before logging.
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

## Vision Analysis & Nutrition Labels
- **Food Photos**: Identify items and ESTIMATE portions. Use visual cues. If unsure, give a range or ask "how much?".
- **Nutrition Labels**: EXTRACT values precisely (Calories, Protein, Fat, Carbs, Fiber, Serving Size). Ask "How many servings?".
- **Receipts/Menus**: Extract food items and estimate nutrition based on standard values.

## Correcting/Updating Logs
- To change, correct, or update ANY aspect of a previously logged item:
    1.  **FIRST** use \`searchFoodLogs\` to find the item's \`logId\`
    2.  If multiple matches, **ASK** the user to clarify
    3.  Use \`updateFoodLog\` with the specific \`logId\`
- **NEVER** use \`logFood\` to create "adjustment" entries. Always use \`updateFoodLog\`.
- **NEVER** guess the \`logId\`. Always search first.

## Referencing Previous Meals
- When the user mentions **leftovers**, **"same as yesterday"**, **"what I had earlier"**, or similar references to past meals:
    1. Use \`searchFoodLogs\` with the appropriate date to find the referenced meal
    2. Use the same nutrition values from the previous log (adjusting quantity if specified)
    3. Log as a new entry for today with the matched nutrition data
- When the user says they want to **correct** or **change** something:
    1. Proactively use \`searchFoodLogs\` to find potential matches
    2. Show the user what you found and confirm which item to update
    3. Use \`updateFoodLog\` with the correct logId
- When the user says **"I actually had X instead of Y"** or **"that was wrong"**:
    1. Search for the original item first, confirm the match, then update

## Deleting Logs
- To remove a food log entry, use \`deleteFoodLog\`:
    1.  Use \`searchFoodLogs\` to find the item(s)
    2.  **Tell the user exactly which item(s) you plan to delete** (name, meal, calories)
    3.  **Wait for explicit confirmation** before calling \`deleteFoodLog\`
    4.  After deleting, confirm what was removed and show updated daily totals
- If clearly unambiguous and explicitly requested in the same message, you may search and delete in one turn — still confirm afterward.
- **NEVER** zero out values with \`updateFoodLog\` as a substitute for deletion.`;

const ONBOARDING_ADDENDUM = `

## Onboarding & Profile Setup

When context shows **ONBOARDING NEEDED**, guide the user through profile setup:

### Data Collection Flow
1. **Greet warmly**, introduce yourself as Kalli. Briefly explain WHY you're collecting this info: "So I can calculate your personal calorie and macro targets using science-backed formulas — everything stays in your profile, and you can update it anytime."
2. **Collect conversationally** (2-3 questions per message, natural back-and-forth):
   - Name → weight + height → age → gender → goal (lose weight / maintain / gain muscle) → activity level
3. **Parse natural formats**: "5'11" → 71 in, "168 lbs" → 168 lbs, "lose weight" → lose_weight, "pretty active" → moderately_active, etc.
4. If user skips a field, use reasonable defaults and note what was defaulted.

### Present Recommendations BEFORE Saving
Once all info is collected, do NOT immediately call updateUserProfile. Instead:
1. **Calculate and present** the recommendations conversationally, including:
   - **BMR** (Basal Metabolic Rate) — briefly explain: "This is roughly what your body burns at rest"
   - **TDEE** (Total Daily Energy Expenditure) — "This factors in your activity level"
   - **Target calories** — explain the adjustment (e.g., "I subtracted 500 cal for a moderate deficit")
   - **Macro split** — protein, carbs, fat targets with brief rationale
2. **Invite adjustments**: "These are my recommendations — want to tweak anything? For example, you could say 'lower calories to 1800' or 'bump protein up a bit'."
3. **Wait for explicit confirmation** ("looks good", "save it", "yes", etc.) or adjustments before calling \`updateUserProfile\`.
4. If user requests overrides, acknowledge the change, show the updated numbers, and confirm again.
5. Only after confirmation: call \`updateUserProfile\` with all data + any \`targetOverrides\`.
6. After saving, celebrate briefly and invite them to log their first meal.

### Re-onboarding (Profile Update)
When user asks to update profile/body stats/goals:
- Show current values from context ("You're currently at 168 lbs, 5'11, with a weight loss goal — still accurate?")
- Re-collect changed fields only
- Present updated calculations with the same BMR/TDEE/targets breakdown
- Confirm before calling \`updateUserProfile\``;

const mergeFoodLogs = (existing, incoming) => {
    if (!existing) return incoming;

    // Deduplicate items by id (if available) or name+meal+calories
    const existingIds = new Set(existing.items.map(i => i.id).filter(Boolean));
    const existingKeys = new Set(existing.items.map(i => `${i.name}|${i.meal || ''}|${i.calories}`));

    const newItems = incoming.items.filter(item => {
        if (item.id && existingIds.has(item.id)) return false;
        if (!item.id) {
            const key = `${item.name}|${item.meal || ''}|${item.calories}`;
            if (existingKeys.has(key)) return false;
        }
        return true;
    });

    return {
        date: existing.date,
        meal: existing.meal === incoming.meal ? existing.meal : 'mixed',
        items: [...existing.items, ...newItems],
        count: existing.count + newItems.length,
        totalCalories: existing.totalCalories + newItems.reduce((s, i) => s + (i.calories || 0), 0),
        totalProtein: existing.totalProtein + newItems.reduce((s, i) => s + (i.protein || 0), 0),
        totalCarbs: existing.totalCarbs + newItems.reduce((s, i) => s + (i.carbs || 0), 0),
        totalFat: existing.totalFat + newItems.reduce((s, i) => s + (i.fat || 0), 0),
    };
};

const buildChatHistory = (messages) => {
    return messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));
};

const processMessage = async (message, chatHistory, userProfile, userId, userTimezone, idempotencyKey) => {
    try {
        const modelName = MODELS.flash;

        const { context: enhancedContext, needsOnboarding } = await buildEnhancedContext(userId, userTimezone, userProfile);
        const systemInstruction = needsOnboarding ? BASE_SYSTEM_PROMPT + ONBOARDING_ADDENDUM : BASE_SYSTEM_PROMPT;

        const contents = [
            { role: 'user', parts: [{ text: enhancedContext }] },
            { role: 'model', parts: [{ text: 'Got it — I have your latest context. How can I help?' }] },
            ...buildChatHistory(chatHistory),
            { role: 'user', parts: [{ text: message }] }
        ];

        // Helpers
        const getResponseText = (response) => {
            const candidate = response.candidates?.[0];
            if (candidate?.finishReason !== 'STOP') {
                getLogger().warn({
                    finishReason: candidate?.finishReason,
                    safetyRatings: candidate?.safetyRatings
                }, 'Gemini generation finished potentially incomplete');
            }
            return candidate?.content?.parts?.find(p => p.text)?.text || '';
        };

        const getFunctionCalls = (response) => {
            const candidate = response.candidates?.[0];
            return candidate?.content?.parts
                ?.filter(p => p.functionCall)
                .map(p => p.functionCall) || [];
        };

        // Try to use cached system instruction + tools
        const cacheName = await getOrCreateCache(needsOnboarding);
        const config = cacheName
            ? {
                maxOutputTokens: 8192,
                temperature: 1.0,
                thinkingConfig: { thinkingLevel: 'LOW' },
                cachedContent: cacheName
            }
            : {
                systemInstruction,
                maxOutputTokens: 8192,
                temperature: 1.0,
                tools: [{ functionDeclarations: toolDeclarations }],
                thinkingConfig: { thinkingLevel: 'LOW' }
            };

        const payload = {
            model: modelName,
            contents,
            config
        };

        let result = await genAI.models.generateContent(payload);

        let toolsUsed = [];
        let foodLog = null;
        let responseText = getResponseText(result);
        let functionCalls = getFunctionCalls(result);

        while (functionCalls.length > 0) {
            const functionResponses = [];

            for (const call of functionCalls) {
                getLogger().info({ tool: call.name }, 'Executing tool');
                toolsUsed.push(call.name);

                const toolResult = await executeTool(call.name, call.args, userId, userTimezone, idempotencyKey);

                if (call.name === 'logFood' && toolResult.success) {
                    foodLog = mergeFoodLogs(foodLog, toolResult.data);
                }

                functionResponses.push({
                    name: call.name,
                    response: toolResult
                });
            }

            const toolResponseParts = functionResponses.map(fr => ({
                functionResponse: {
                    name: fr.name,
                    response: fr.response
                }
            }));

            result = await genAI.models.generateContent({
                model: modelName,
                contents: [
                    ...contents,
                    { role: 'model', parts: result.candidates[0].content.parts },
                    { role: 'user', parts: toolResponseParts }
                ],
                config
            });

            responseText = getResponseText(result);
            functionCalls = getFunctionCalls(result);
        }

        return {
            text: responseText,
            model: modelName,
            tokensUsed: result.usageMetadata?.totalTokenCount,
            toolsUsed,
            foodLog
        };
    } catch (error) {
        getLogger().error({
            err: error,
            errorMessage: error.message,
            errorStatus: error.status,
            errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error))
        }, 'Gemini API error');
        throw error;
    }
};

const processImageMessage = async (message, images, chatHistory, userProfile, userId, userTimezone, idempotencyKey) => {
    const modelName = MODELS.flash;
    // Support both single imageBase64 string (legacy) and array of images
    const imageArray = Array.isArray(images) ? images : [images];
    getLogger().info({ modelName, hasMessage: !!message, imageCount: imageArray.length }, 'Processing image message');

    try {
        const { context: enhancedContext, needsOnboarding } = await buildEnhancedContext(userId, userTimezone, userProfile);
        const systemInstruction = needsOnboarding ? BASE_SYSTEM_PROMPT + ONBOARDING_ADDENDUM : BASE_SYSTEM_PROMPT;
        const userText = message || 'What food is in this image? Please identify and log it.';

        const parts = [];
        parts.push({ text: userText });
        for (const img of imageArray) {
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: img
                }
            });
        }

        const contents = [
            { role: 'user', parts: [{ text: enhancedContext }] },
            { role: 'model', parts: [{ text: 'Got it — I have your latest context. How can I help?' }] },
            ...buildChatHistory(chatHistory.slice(0, -1)),
            { role: 'user', parts }
        ];

        const getImgResponseText = (response) =>
            response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || '';

        const getImgFunctionCalls = (response) =>
            response.candidates?.[0]?.content?.parts
                ?.filter(p => p.functionCall)
                .map(p => p.functionCall) || [];

        // Try to use cached system instruction + tools
        const cacheName = await getOrCreateCache(needsOnboarding);
        const imgConfig = cacheName
            ? {
                maxOutputTokens: 4096,
                temperature: 1.0,
                thinkingConfig: { thinkingLevel: 'LOW' },
                cachedContent: cacheName
            }
            : {
                systemInstruction,
                maxOutputTokens: 4096,
                temperature: 1.0,
                tools: [{ functionDeclarations: toolDeclarations }],
                thinkingConfig: { thinkingLevel: 'LOW' }
            };

        const payload = {
            model: modelName,
            contents,
            config: imgConfig
        };

        let result = await genAI.models.generateContent(payload);

        let toolsUsed = [];
        let foodLog = null;
        let responseText = getImgResponseText(result);
        let functionCalls = getImgFunctionCalls(result);

        while (functionCalls.length > 0) {
            const functionResponses = [];

            for (const call of functionCalls) {
                getLogger().info({ tool: call.name }, 'Executing tool');
                toolsUsed.push(call.name);

                const toolResult = await executeTool(call.name, call.args, userId, userTimezone, idempotencyKey, { source: 'photo' });

                if (call.name === 'logFood' && toolResult.success) {
                    foodLog = mergeFoodLogs(foodLog, toolResult.data);
                }

                functionResponses.push({
                    name: call.name,
                    response: toolResult
                });
            }

            const toolResponseParts = functionResponses.map(fr => ({
                functionResponse: {
                    name: fr.name,
                    response: fr.response
                }
            }));

            result = await genAI.models.generateContent({
                model: modelName,
                contents: [
                    ...contents,
                    { role: 'model', parts: result.candidates[0].content.parts },
                    { role: 'user', parts: toolResponseParts }
                ],
                config: imgConfig
            });

            responseText = getImgResponseText(result);
            functionCalls = getImgFunctionCalls(result);
        }

        return {
            text: responseText,
            model: modelName,
            tokensUsed: result.usageMetadata?.totalTokenCount,
            toolsUsed,
            foodLog
        };
    } catch (error) {
        getLogger().error({
            err: error,
            errorMessage: error.message,
            errorStatus: error.status,
            errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error))
        }, 'Gemini API error (image)');
        throw error;
    }
};

const getYesterdayStr = (timezone) => {
    const now = new Date();
    if (timezone) {
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone });
        const d = parseLocalDate(todayStr);
        d.setDate(d.getDate() - 1);
        return toDateStr(d);
    }
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return toDateStr(d);
};

const sumLogs = (logs) => {
    return logs.reduce((acc, log) => ({
        calories: acc.calories + (log.calories || 0),
        protein: acc.protein + (log.protein || 0),
        carbs: acc.carbs + (log.carbs || 0),
        fat: acc.fat + (log.fat || 0),
        count: acc.count + 1,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
};

const getDayLogs = async (userId, dateStr) => {
    const snapshot = await db.collection('users').doc(userId)
        .collection('foodLogs')
        .where('date', '==', dateStr)
        .get();
    return snapshot.docs.map(d => d.data());
};

const getRecentDayLogs = async (userId, timezone, days = 3) => {
    const now = new Date();
    const dates = [];
    for (let i = 1; i <= days; i++) {
        const d = new Date(now);
        if (timezone) {
            const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone });
            const base = parseLocalDate(todayStr);
            base.setDate(base.getDate() - i);
            dates.push(toDateStr(base));
        } else {
            d.setDate(d.getDate() - i);
            dates.push(toDateStr(d));
        }
    }

    const allLogs = await Promise.all(dates.map(date => getDayLogs(userId, date)));
    const daysWithData = allLogs.filter(logs => logs.length > 0);

    if (daysWithData.length === 0) return null;

    const totals = daysWithData.map(sumLogs);
    const count = totals.length;
    return {
        days: count,
        avgCalories: Math.round(totals.reduce((s, t) => s + t.calories, 0) / count),
        avgProtein: Math.round(totals.reduce((s, t) => s + t.protein, 0) / count),
        avgCarbs: Math.round(totals.reduce((s, t) => s + t.carbs, 0) / count),
        avgFat: Math.round(totals.reduce((s, t) => s + t.fat, 0) / count),
    };
};

const formatLogsByMeal = (logs, label) => {
    if (!logs || logs.length === 0) return '';
    const groups = {};
    for (const log of logs) {
        const meal = log.meal || 'snack';
        if (!groups[meal]) groups[meal] = [];
        groups[meal].push(log);
    }
    const mealOrder = { breakfast: 1, lunch: 2, dinner: 3, snack: 4 };
    const sorted = Object.entries(groups).sort(([a], [b]) => (mealOrder[a] || 5) - (mealOrder[b] || 5));
    let out = `\n${label}:\n`;
    for (const [meal, items] of sorted) {
        const itemStrs = items.map(i => `${i.name} ${Math.round(i.calories || 0)} cal`).join(', ');
        out += `- ${meal.charAt(0).toUpperCase() + meal.slice(1)}: ${itemStrs}\n`;
    }
    // Note missing meals for yesterday context
    const loggedMeals = new Set(Object.keys(groups));
    const allMeals = ['breakfast', 'lunch', 'dinner'];
    const missing = allMeals.filter(m => !loggedMeals.has(m));
    if (missing.length > 0 && missing.length < 3) {
        out += `- (No ${missing.join(' or ')} logged)\n`;
    }
    return out;
};

const buildEnhancedContext = async (userId, userTimezone, userProfile) => {
    const today = getTodayStr(userTimezone);
    const yesterday = getYesterdayStr(userTimezone);

    let goals, todayLogs, yesterdayLogs, recentAvg;
    try {
        [goals, todayLogs, yesterdayLogs, recentAvg] = await Promise.all([
            getGoalsForDate(userId, today),
            getDayLogs(userId, today),
            getDayLogs(userId, yesterday),
            getRecentDayLogs(userId, userTimezone, 3),
        ]);
    } catch (err) {
        getLogger().warn({ err }, 'Failed to build enhanced context, falling back to basic');
        return { context: `[Context: Today is ${today}. Timezone: ${userTimezone || 'UTC'}]\n\n`, needsOnboarding: false };
    }

    const userData = userProfile || {};
    const firstName = userData.firstName || '';
    const biometrics = userData.biometrics || {};
    let needsOnboarding = false;

    const todaySummary = sumLogs(todayLogs);
    const yesterdaySummary = yesterdayLogs.length > 0 ? sumLogs(yesterdayLogs) : null;

    // Current time and day of week for temporal awareness
    const tz = userTimezone || 'UTC';
    const now = new Date();
    const timeStr = now.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
    const dayName = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' });

    let context = `[COACHING CONTEXT — Use this data naturally in conversation. Do NOT dump it as a list.]\n`;
    context += `Date: ${dayName}, ${today} | Time: ${timeStr} | Timezone: ${tz}\n`;

    if (firstName) {
        context += `User goes by: ${firstName} (use sparingly — most replies need no name)\n`;
    }

    context += `\nDaily Goals: ${goals.targetCalories} cal, ${goals.targetProtein}g protein, ${goals.targetCarbs}g carbs, ${goals.targetFat}g fat\n`;

    context += `\nToday's Progress (${todaySummary.count} items logged): ${todaySummary.calories} cal, ${todaySummary.protein}g protein, ${todaySummary.carbs}g carbs, ${todaySummary.fat}g fat`;
    context += `\nRemaining: ${goals.targetCalories - todaySummary.calories} cal, ${goals.targetProtein - todaySummary.protein}g protein, ${goals.targetCarbs - todaySummary.carbs}g carbs, ${goals.targetFat - todaySummary.fat}g fat\n`;

    if (todaySummary.count === 0) {
        context += `(No food logged yet today — this may be the user's first interaction of the day.)\n`;
    } else {
        context += formatLogsByMeal(todayLogs, 'Items logged today');
    }

    if (yesterdaySummary) {
        context += `\nYesterday (${yesterday}): ${yesterdaySummary.calories} cal, ${yesterdaySummary.protein}g protein, ${yesterdaySummary.carbs}g carbs, ${yesterdaySummary.fat}g fat\n`;
        context += formatLogsByMeal(yesterdayLogs, 'Yesterday\'s items');
    }

    if (recentAvg) {
        context += `\nRecent ${recentAvg.days}-day averages: ${recentAvg.avgCalories} cal, ${recentAvg.avgProtein}g protein, ${recentAvg.avgCarbs}g carbs, ${recentAvg.avgFat}g fat\n`;
    }

    if (biometrics.weight || biometrics.goalType) {
        context += `\nUser Biometrics:`;
        if (biometrics.weight) context += ` Weight: ${biometrics.weight} ${biometrics.weightUnit || 'lbs'}.`;
        if (biometrics.height) context += ` Height: ${biometrics.height} ${biometrics.heightUnit || 'in'}.`;
        if (biometrics.age) context += ` Age: ${biometrics.age}.`;
        if (biometrics.gender) context += ` Gender: ${biometrics.gender}.`;
        if (biometrics.goalType) context += ` Goal: ${biometrics.goalType.replace(/_/g, ' ')}.`;
        if (biometrics.activityLevel) context += ` Activity: ${biometrics.activityLevel.replace(/_/g, ' ')}.`;
        if (biometrics.dietaryPreferences?.length) context += ` Diet: ${biometrics.dietaryPreferences.join(', ')}.`;
        context += '\n';
    } else {
        context += `\n**ONBOARDING NEEDED** — No biometrics set. If the user wants to get started or set up their profile, begin the onboarding conversation. Otherwise respond normally but mention they can set up their profile for personalized coaching.\n`;
        needsOnboarding = true;
    }

    context += `[END CONTEXT]\n\n`;
    return { context, needsOnboarding };
};

module.exports = {
    processMessage,
    processImageMessage
};
