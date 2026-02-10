const { db } = require('../services/firebase');
const { FieldValue } = require('firebase-admin/firestore');

const ALLOWED_UPDATE_KEYS = ['name', 'quantity', 'unit', 'calories', 'protein', 'carbs', 'fat', 'meal', 'date'];

const serializeTimestamps = (data) => ({
    createdAt: data.createdAt?.toDate?.() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
});

const foodLogsRef = (userId) => db.collection('users').doc(userId).collection('foodLogs');

const getLogs = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { startDate, endDate, meal } = req.query;

        req.log.info({ action: 'food.getLogs', startDate, endDate, meal }, 'Fetching food logs');

        let query = foodLogsRef(userId).orderBy('date', 'desc');

        if (startDate) query = query.where('date', '>=', startDate);
        if (endDate) query = query.where('date', '<=', endDate);
        if (meal) query = query.where('meal', '==', meal);

        const snapshot = await query.limit(100).get();
        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            ...serializeTimestamps(doc.data())
        }));

        req.log.info({ action: 'food.getLogs', count: logs.length }, 'Food logs fetched');

        res.json({ logs });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get food logs');
        res.status(500).json({ error: 'Failed to get food logs' });
    }
};

const getLog = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { id } = req.params;

        req.log.info({ action: 'food.getLog', logId: id }, 'Fetching food log');

        const doc = await foodLogsRef(userId).doc(id).get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Food log not found' });
        }

        req.log.info({ action: 'food.getLog', logId: id }, 'Food log fetched');

        res.json({
            id: doc.id,
            ...doc.data(),
            ...serializeTimestamps(doc.data())
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get food log');
        res.status(500).json({ error: 'Failed to get food log' });
    }
};

const createLog = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { date, meal, items, source = 'manual', originalMessage } = req.body;

        req.log.info({
            action: 'food.createLog',
            date,
            meal,
            source,
            items: items?.map(i => ({ name: i.name, calories: i.calories }))
        }, 'Creating food log');

        if (!date || !meal || !items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'date, meal, and items array required' });
        }

        const batch = db.batch();
        const createdLogs = [];

        for (const item of items) {
            const docRef = foodLogsRef(userId).doc();
            const foodLogItem = {
                date,
                meal,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                calories: item.calories || 0,
                protein: item.protein || 0,
                carbs: item.carbs || 0,
                fat: item.fat || 0,
                originalMessage: originalMessage || '',
                source,
                corrected: false,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            };
            batch.set(docRef, foodLogItem);
            createdLogs.push({ id: docRef.id, ...foodLogItem, createdAt: new Date() });
        }

        await batch.commit();

        req.log.info({
            action: 'food.createLog',
            logIds: createdLogs.map(l => l.id),
            totalCalories: createdLogs.reduce((sum, l) => sum + (l.calories || 0), 0)
        }, 'Food log created');

        res.status(201).json({ success: true, logs: createdLogs });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to create food log');
        res.status(500).json({ error: 'Failed to create food log' });
    }
};

const updateLog = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { id } = req.params;
        const updates = req.body;

        req.log.info({
            action: 'food.updateLog',
            logId: id,
            updateFields: Object.keys(updates)
        }, 'Updating food log');

        const docRef = foodLogsRef(userId).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Food log not found' });
        }

        const cleanUpdates = {};
        Object.keys(updates).forEach(k => {
            if (ALLOWED_UPDATE_KEYS.includes(k)) cleanUpdates[k] = updates[k];
        });

        if (Object.keys(cleanUpdates).length === 0) {
            return res.status(400).json({ error: 'No valid updates provided' });
        }

        cleanUpdates.updatedAt = FieldValue.serverTimestamp();
        cleanUpdates.corrected = true;

        await docRef.update(cleanUpdates);

        req.log.info({ action: 'food.updateLog', logId: id }, 'Food log updated');

        const updated = await docRef.get();
        res.json({
            id: updated.id,
            ...updated.data(),
            ...serializeTimestamps(updated.data()),
            updatedAt: new Date()
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to update food log');
        res.status(500).json({ error: 'Failed to update food log' });
    }
};

const deleteLog = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { id } = req.params;

        req.log.info({ action: 'food.deleteLog', logId: id }, 'Deleting food log');

        const docRef = foodLogsRef(userId).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Food log not found' });
        }

        await docRef.delete();

        req.log.info({ action: 'food.deleteLog', logId: id }, 'Food log deleted');

        res.json({ success: true });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to delete food log');
        res.status(500).json({ error: 'Failed to delete food log' });
    }
};

module.exports = {
    getLogs,
    getLog,
    createLog,
    updateLog,
    deleteLog
};
