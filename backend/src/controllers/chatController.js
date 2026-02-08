const { db } = require('../services/firebase');
const { processMessage, processImageMessage } = require('../services/geminiService');

/**
 * Send a message to Cally
 * Supports text and optional image attachments
 */
const sendMessage = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { message, imageBase64 } = req.body;

        if (!message && !imageBase64) {
            return res.status(400).json({ error: 'Message or image required' });
        }

        const userRef = db.collection('users').doc(userId);
        const chatHistoryRef = userRef.collection('chatHistory');

        // Store user message
        const userMessage = {
            role: 'user',
            content: message || '',
            imageData: imageBase64 ? true : false, // Flag that image was sent (not storing the image)
            timestamp: new Date(),
            metadata: {}
        };
        const userMsgDoc = await chatHistoryRef.add(userMessage);

        // Get recent chat history for context (last 20 messages)
        const historySnapshot = await chatHistoryRef
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();

        const chatHistory = historySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .reverse();

        // Get user profile for goals context
        const userDoc = await userRef.get();
        const userProfile = userDoc.exists ? userDoc.data() : {};

        // Process with Gemini
        let response;
        if (imageBase64) {
            response = await processImageMessage(message, imageBase64, chatHistory, userProfile, userId, req.body.userTimezone);
        } else {
            response = await processMessage(message, chatHistory, userProfile, userId, req.body.userTimezone);
        }

        // Store assistant response
        const assistantMessage = {
            role: 'assistant',
            content: response.text,
            timestamp: new Date(),
            foodLog: response.foodLog || null, // Store food log data for UI card persistence
            metadata: {
                model: response.model,
                tokensUsed: response.tokensUsed || null,
                linkedFoodLogId: response.foodLogId || null,
                toolsUsed: response.toolsUsed || []
            }
        };
        const assistantMsgDoc = await chatHistoryRef.add(assistantMessage);

        res.json({
            userMessageId: userMsgDoc.id,
            assistantMessageId: assistantMsgDoc.id,
            response: response.text,
            foodLog: response.foodLog || null
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to process message');
        res.status(500).json({ error: 'Failed to process message' });
    }
};

/**
 * Get chat history with pagination
 */
const getHistory = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { limit = 50, before } = req.query;

        const chatHistoryRef = db.collection('users').doc(userId).collection('chatHistory');

        let query = chatHistoryRef.orderBy('timestamp', 'desc').limit(parseInt(limit));

        if (before) {
            const beforeDoc = await chatHistoryRef.doc(before).get();
            if (beforeDoc.exists) {
                query = query.startAfter(beforeDoc);
            }
        }

        const snapshot = await query.get();
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
        })).reverse();

        res.json({ messages });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get chat history');
        res.status(500).json({ error: 'Failed to get chat history' });
    }
};

/**
 * Clear all chat history for user
 */
const clearHistory = async (req, res) => {
    try {
        const userId = req.user.uid;
        const chatHistoryRef = db.collection('users').doc(userId).collection('chatHistory');

        const snapshot = await chatHistoryRef.get();
        const batch = db.batch();

        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        res.json({ success: true, deletedCount: snapshot.size });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to clear chat history');
        res.status(500).json({ error: 'Failed to clear chat history' });
    }
};

/**
 * Delete a specific message
 */
const deleteMessage = async (req, res) => {
    try {
        const userId = req.user.uid;
        const messageId = req.params.id;

        await db.collection('users').doc(userId).collection('chatHistory').doc(messageId).delete();

        res.json({ success: true, id: messageId });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to delete message');
        res.status(500).json({ error: 'Failed to delete message' });
    }
};

module.exports = {
    sendMessage,
    getHistory,
    clearHistory,
    deleteMessage
};
