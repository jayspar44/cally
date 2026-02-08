const { GoogleGenAI } = require('@google/genai');
const logger = require('../logger');
const { executeTool, toolDeclarations } = require('../agents/agentTools');

// Initialize Gemini with @google/genai SDK
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Model configuration - Using Gemini 3 for latest features
const MODELS = {
    flash: 'gemini-3-flash-preview',
    pro: 'gemini-3-pro-preview'
};

// Cally's system prompt
const SYSTEM_PROMPT = `You are Cally, an expert AI nutrition companion. You help users track their calorie and macronutrient intake through natural conversation.

## Your Expertise
- Expert knowledge of food nutrition (calories, protein, carbs, fat, fiber)
- Skilled at estimating portion sizes and quantities
- Familiar with common restaurant meals, packaged foods, and home-cooked dishes
- Understanding of dietary patterns and nutritional balance

## Your Personality
- Friendly, encouraging, and non-judgmental
- Concise and helpful - don't be overly verbose
- Proactive when you notice patterns or opportunities to help
- Celebrate wins (hitting protein goals, staying in calorie range)

## How You Work
1. When a user tells you what they ate/are eating:
   - Identify the foods and estimate quantities
   - If quantities are ambiguous, ask for clarification (e.g., "How many slices?" or "Was that a small, medium, or large portion?")
   - Use the logFood tool to record the meal once you have enough info.
   - **Crucial**: If the user did not specify breakfast/lunch/dinner/snack and you cannot be 100% sure from the time/context, **ASK them** "Was this for breakfast, lunch, or a snack?" before logging.
   - Confirm what was logged with a brief summary

2. When a user sends a photo:
   - Identify the foods visible in the image
   - Estimate portions based on visual cues
   - Ask for clarification if needed
   - Log the identified foods

3. When providing guidance:
   - Reference the user's daily totals and goals
   - Offer specific, actionable suggestions
   - Be encouraging but realistic

## Important Rules
- Always use the tools provided to log food - don't just describe nutrition
- Be precise with nutrition estimates - use your training data
- If unsure about a food, ask for clarification rather than guessing wrong
- Keep responses concise - users want quick logging, not long explanations
- Format nutrition info clearly when summarizing
- Format nutrition info clearly when summarizing
- **Meal Categorization**: You should try to categorize foods into 'breakfast', 'lunch', 'dinner', or 'snack' based on the time of day. **However, if it is not clear or could be multiple things (e.g. eating cereal at 3 PM), YOU MUST ASK the user to clarify which meal it is before logging.** Do not guess if ambiguous.
    
## Vision Analysis & Nutrition Labels
- **Food Photos**: Identify items and ESTIMATE portions. Use visual cues. If unsure, give a range or ask "how much?".
- **Nutrition Labels**: If you see a label, EXTRACT values precisely (Calories, Protein, Fat, Carbs, Fiber, Serving Size). Ask "How many servings?".
- **Receipts/Menus**: Extract food items and estimate nutrition based on standard values.`;

/**
 * Build chat history for Gemini API format
 */
const buildChatHistory = (messages) => {
    return messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));
};

/**
 * Determine which model to use based on content
 * Uses Pro for: images, complex analysis requests
 * Uses Flash for: simple chat, logging requests
 */
const selectModel = (message, hasImage) => {
    if (hasImage) {
        return MODELS.pro;
    }

    // Complex analysis keywords
    const complexKeywords = [
        'analyze', 'breakdown', 'detailed', 'explain', 'compare',
        'weekly', 'monthly', 'trend', 'pattern', 'recommendation'
    ];

    const lowerMessage = (message || '').toLowerCase();
    if (complexKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return MODELS.pro;
    }

    return MODELS.flash;
};

/**
 * Process a text message with Gemini
 */
const processMessage = async (message, chatHistory, userProfile, userId, userTimezone) => {
    try {
        const modelName = MODELS.flash;

        const today = userTimezone
            ? new Date().toLocaleDateString('en-CA', { timeZone: userTimezone })
            : new Date().toISOString().split('T')[0];

        // Construct prompt with context
        const contents = [
            { role: 'user', parts: [{ text: `Current Date: ${today}\nUser Timezone: ${userTimezone || 'UTC'}\n\n` + SYSTEM_PROMPT }] },
            ...chatHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })),
            { role: 'user', parts: [{ text: message }] }
        ];

        // Helpers
        const getResponseText = (response) => {
            const candidate = response.candidates?.[0];
            if (candidate?.finishReason !== 'STOP') {
                logger.warn({
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

        const payload = {
            model: modelName,
            contents,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                maxOutputTokens: 8192,
                temperature: 0.7,
                tools: [{ functionDeclarations: toolDeclarations }]
            }
        };

        // DEBUG: Sanitize payload for logging (deep clone)
        const logPayload = JSON.parse(JSON.stringify(payload));
        // Remove huge base64 strings if any (though unlikely in text flow)
        if (logPayload.contents) {
            logPayload.contents.forEach(c => {
                if (c.parts) c.parts.forEach(p => {
                    if (p.inlineData) p.inlineData.data = '[BASE64_IMAGE_TRUNCATED]';
                });
            });
        }
        logger.info({ payload: JSON.stringify(logPayload, null, 2) }, 'Sending Gemini Request (DEBUG)');

        let result = await genAI.models.generateContent(payload);

        let toolsUsed = [];
        let foodLog = null;
        let responseText = getResponseText(result);
        let functionCalls = getFunctionCalls(result);

        // Handle function calls (tool use)
        while (functionCalls.length > 0) {
            const functionResponses = [];

            for (const call of functionCalls) {
                logger.info({ tool: call.name }, 'Executing tool');
                toolsUsed.push(call.name);

                const toolResult = await executeTool(call.name, call.args, userId, userTimezone);

                if (call.name === 'logFood' && toolResult.success) {
                    foodLog = toolResult.data;
                }

                functionResponses.push({
                    name: call.name,
                    response: toolResult
                });
            }

            // Continue conversation with tool results
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
                config: {
                    systemInstruction: SYSTEM_PROMPT,
                    maxOutputTokens: 8192,
                    temperature: 0.7,
                }
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
        logger.error({
            err: error,
            errorMessage: error.message,
            errorStatus: error.status,
            errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error))
        }, 'Gemini API error');
        throw error;
    }
};

/**
 * Process an image message and return AI response
 */
const processImageMessage = async (message, imageBase64, chatHistory, userProfile, userId, userTimezone) => {
    const modelName = MODELS.pro; // Always use Pro for images
    logger.info({ modelName, hasMessage: !!message }, 'Processing image message');

    try {
        // Build message with image
        const parts = [];

        const contextText = message
            ? buildContextMessage(message, userProfile)
            : buildContextMessage('What food is in this image? Please identify and log it.', userProfile);

        parts.push({ text: contextText });

        // Add image as inline data
        parts.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64
            }
        });

        // Add contents for image message
        const contents = [
            ...buildChatHistory(chatHistory.slice(0, -1)),
            { role: 'user', parts }
        ];

        // Helpers
        const getResponseText = (response) => {
            const candidate = response.candidates?.[0];
            return candidate?.content?.parts?.find(p => p.text)?.text || '';
        };

        const getFunctionCalls = (response) => {
            const candidate = response.candidates?.[0];
            return candidate?.content?.parts
                ?.filter(p => p.functionCall)
                .map(p => p.functionCall) || [];
        };

        const payload = {
            model: modelName,
            contents,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                maxOutputTokens: 1024,
                temperature: 0.7,
                tools: [{ functionDeclarations: toolDeclarations }]
            }
        };

        let result = await genAI.models.generateContent(payload);

        let toolsUsed = [];
        let foodLog = null;
        let responseText = getResponseText(result);
        let functionCalls = getFunctionCalls(result);

        // Handle function calls
        while (functionCalls.length > 0) {
            const functionResponses = [];

            for (const call of functionCalls) {
                logger.info({ tool: call.name }, 'Executing tool');
                toolsUsed.push(call.name);

                const toolResult = await executeTool(call.name, call.args, userId, userTimezone);

                if (call.name === 'logFood' && toolResult.success) {
                    foodLog = toolResult.data;
                }

                functionResponses.push({
                    name: call.name,
                    response: toolResult
                });
            }

            // Continue the conversation with tool results
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
                config: {
                    systemInstruction: SYSTEM_PROMPT,
                    maxOutputTokens: 1024,
                    temperature: 0.7,
                }
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
        logger.error({
            err: error,
            errorMessage: error.message,
            errorStatus: error.status,
            errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error))
        }, 'Gemini API error (image)');
        throw error;
    }
};

/**
 * Build context-enhanced message with user profile info
 */
const buildContextMessage = (message, userProfile) => {
    const settings = userProfile?.settings || {};
    const today = userProfile?.timezone
        ? new Date().toLocaleDateString('en-CA', { timeZone: userProfile.timezone })
        : new Date().toISOString().split('T')[0];

    let context = `[Context: Today is ${today}.`;

    if (settings.targetCalories) {
        context += ` User's daily goals: ${settings.targetCalories} cal`;
        if (settings.targetProtein) context += `, ${settings.targetProtein}g protein`;
        if (settings.targetCarbs) context += `, ${settings.targetCarbs}g carbs`;
        if (settings.targetFat) context += `, ${settings.targetFat}g fat`;
        context += '.';
    }

    context += ']\n\n';

    return context + message;
};

module.exports = {
    processMessage,
    processImageMessage,
    selectModel,
    MODELS
};
