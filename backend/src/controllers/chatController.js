const { db } = require('../services/firebase');
const { processMessage, processImageMessage } = require('../services/geminiService');

const sendMessage = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { message, imageBase64 } = req.body;

        req.log.info({
            action: 'chat.sendMessage',
            hasImage: !!imageBase64,
            messageLength: message?.length || 0,
            messagePreview: message?.substring(0, 200) || ''
        }, 'Processing chat message');

        if (!message && !imageBase64) {
            return res.status(400).json({ error: 'Message or image required' });
        }

        const userRef = db.collection('users').doc(userId);
        const chatHistoryRef = userRef.collection('chatHistory');

        const userMessage = {
            role: 'user',
            content: message || '',
            imageData: !!imageBase64,
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

        const response = imageBase64
            ? await processImageMessage(message, imageBase64, chatHistory, userProfile, userId, req.body.userTimezone)
            : await processMessage(message, chatHistory, userProfile, userId, req.body.userTimezone);

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
            foodLog: response.foodLog || null
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
