const crypto = require('crypto');
const { db } = require('../services/firebase');
const { processMessage, processImageMessage } = require('../services/geminiService');

const SERVER_TIMEOUT_MS = 90000;

const checkRecentlyCreatedLogs = async (userId, idempotencyKey) => {
    const snapshot = await db.collection('users').doc(userId)
        .collection('foodLogs')
        .where('idempotencyKey', '==', idempotencyKey)
        .get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

const sendMessage = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { message, imageBase64, images } = req.body;
        const idempotencyKey = crypto.randomUUID();

        // Support images[] array with fallback to single imageBase64
        const imageArray = images && images.length > 0 ? images : (imageBase64 ? [imageBase64] : []);
        const hasImages = imageArray.length > 0;

        req.log.info({
            action: 'chat.sendMessage',
            hasImages,
            imageCount: imageArray.length,
            messageLength: message?.length || 0,
            messagePreview: message?.substring(0, 200) || '',
            idempotencyKey
        }, 'Processing chat message');

        if (!message && !hasImages) {
            return res.status(400).json({ error: 'Message or image required' });
        }

        if (imageArray.length > 5) {
            return res.status(400).json({ error: 'Maximum 5 images per message' });
        }

        const userRef = db.collection('users').doc(userId);
        const chatHistoryRef = userRef.collection('chatHistory');

        const userMessage = {
            role: 'user',
            content: message || '',
            imageData: hasImages,
            imageCount: imageArray.length,
            timestamp: new Date(),
            metadata: {}
        };
        const userMsgDoc = await chatHistoryRef.add(userMessage);

        const historySnapshot = await chatHistoryRef
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();

        const chatHistory = historySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .reverse();

        const userDoc = await userRef.get();
        const userProfile = userDoc.exists ? userDoc.data() : {};

        // Process with server-side timeout
        const processPromise = hasImages
            ? processImageMessage(message, imageArray, chatHistory, userProfile, userId, req.body.userTimezone, idempotencyKey)
            : processMessage(message, chatHistory, userProfile, userId, req.body.userTimezone, idempotencyKey);

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SERVER_TIMEOUT')), SERVER_TIMEOUT_MS)
        );

        let response;
        try {
            response = await Promise.race([processPromise, timeoutPromise]);
        } catch (processingError) {
            if (processingError.message === 'SERVER_TIMEOUT') {
                req.log.warn({ idempotencyKey }, 'Chat processing timed out');
                return res.status(504).json({ error: 'Processing took too long. Try a simpler message or fewer photos.' });
            }

            // Partial-success recovery: check if food was logged despite the error
            const recentLogs = await checkRecentlyCreatedLogs(userId, idempotencyKey);
            if (recentLogs.length > 0) {
                req.log.info({
                    idempotencyKey,
                    logsRecovered: recentLogs.length,
                    error: processingError.message
                }, 'Partial success recovery — food logged but response generation failed');

                const itemNames = recentLogs.map(l => l.name).join(', ');
                const totalCals = recentLogs.reduce((s, l) => s + (l.calories || 0), 0);
                const partialText = `I logged your food (${itemNames} — ${Math.round(totalCals)} cal total), but had trouble generating my full response. Your food log is saved!`;

                const assistantMsg = {
                    role: 'assistant',
                    content: partialText,
                    timestamp: new Date(),
                    metadata: { partialSuccess: true, idempotencyKey }
                };
                const assistantMsgDoc = await chatHistoryRef.add(assistantMsg);

                return res.json({
                    userMessageId: userMsgDoc.id,
                    assistantMessageId: assistantMsgDoc.id,
                    response: partialText,
                    partialSuccess: true,
                    toolsUsed: ['logFood']
                });
            }
            throw processingError;
        }

        const assistantMessage = {
            role: 'assistant',
            content: response.text,
            timestamp: new Date(),
            foodLog: response.foodLog || null,
            metadata: {
                model: response.model,
                tokensUsed: response.tokensUsed || null,
                linkedFoodLogId: response.foodLogId || null,
                toolsUsed: response.toolsUsed || []
            }
        };
        const assistantMsgDoc = await chatHistoryRef.add(assistantMessage);

        req.log.info({
            action: 'chat.sendMessage',
            userMessageId: userMsgDoc.id,
            assistantMessageId: assistantMsgDoc.id,
            model: response.model,
            tokensUsed: response.tokensUsed,
            toolsUsed: response.toolsUsed,
            foodLog: response.foodLog ? {
                meal: response.foodLog.meal,
                count: response.foodLog.count,
                totalCalories: response.foodLog.totalCalories
            } : null
        }, 'Chat message processed');

        res.json({
            userMessageId: userMsgDoc.id,
            assistantMessageId: assistantMsgDoc.id,
            response: response.text,
            foodLog: response.foodLog || null,
            toolsUsed: response.toolsUsed || []
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to process message');
        res.status(500).json({ error: 'Failed to process message' });
    }
};

const getHistory = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { limit = 50, before } = req.query;

        req.log.info({ action: 'chat.getHistory', limit, before }, 'Fetching chat history');

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

        req.log.info({ action: 'chat.getHistory', messageCount: messages.length }, 'Chat history fetched');

        res.json({ messages });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get chat history');
        res.status(500).json({ error: 'Failed to get chat history' });
    }
};

const clearHistory = async (req, res) => {
    try {
        const userId = req.user.uid;
        req.log.info({ action: 'chat.clearHistory' }, 'Clearing chat history');

        const chatHistoryRef = db.collection('users').doc(userId).collection('chatHistory');

        const snapshot = await chatHistoryRef.get();
        const batch = db.batch();

        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        req.log.info({ action: 'chat.clearHistory', deletedCount: snapshot.size }, 'Chat history cleared');

        res.json({ success: true, deletedCount: snapshot.size });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to clear chat history');
        res.status(500).json({ error: 'Failed to clear chat history' });
    }
};

const deleteMessage = async (req, res) => {
    try {
        const userId = req.user.uid;
        const messageId = req.params.id;

        req.log.info({ action: 'chat.deleteMessage', messageId }, 'Deleting chat message');

        await db.collection('users').doc(userId).collection('chatHistory').doc(messageId).delete();

        req.log.info({ action: 'chat.deleteMessage', messageId }, 'Chat message deleted');

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
