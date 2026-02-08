const { db } = require('../services/firebase');
const { FieldValue } = require('firebase-admin/firestore');

/**
 * Get food logs with date range filtering
 */
const getLogs = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { startDate, endDate, meal } = req.query;

        const foodLogsRef = db.collection('users').doc(userId).collection('foodLogs');
        let query = foodLogsRef.orderBy('date', 'desc');

        if (startDate) {
            query = query.where('date', '>=', startDate);
        }
        if (endDate) {
            query = query.where('date', '<=', endDate);
        }
        if (meal) {
            query = query.where('meal', '==', meal);
        }

        const snapshot = await query.limit(100).get();
        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
        }));

        res.json({ logs });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get food logs');
        res.status(500).json({ error: 'Failed to get food logs' });
    }
};

/**
 * Get a single food log by ID
 */
const getLog = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { id } = req.params;

        const docRef = db.collection('users').doc(userId).collection('foodLogs').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Food log not found' });
        }

        res.json({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to get food log');
        res.status(500).json({ error: 'Failed to get food log' });
    }
};

/**
 * Create a new food log entry (or multiple entries)
 */
const createLog = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { date, meal, description, items, source = 'manual', originalMessage } = req.body;

        if (!date || !meal || !items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'date, meal, and items array required' });
        }

        const batch = db.batch();
        const createdLogs = [];

        for (const item of items) {
            const docRef = db.collection('users').doc(userId).collection('foodLogs').doc();
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

        res.status(201).json({
            success: true,
            logs: createdLogs // Return array of created logs
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to create food log');
        res.status(500).json({ error: 'Failed to create food log' });
    }
};

/**
 * Update an existing food log item
 */
const updateLog = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { id } = req.params;
        const updates = req.body;

        const docRef = db.collection('users').doc(userId).collection('foodLogs').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Food log not found' });
        }

        // We only allow updating specific fields
        const allowedKeys = ['name', 'quantity', 'unit', 'calories', 'protein', 'carbs', 'fat', 'meal', 'date'];
        const cleanUpdates = {};

        Object.keys(updates).forEach(k => {
            if (allowedKeys.includes(k)) cleanUpdates[k] = updates[k];
        });

        if (Object.keys(cleanUpdates).length === 0) {
            return res.status(400).json({ error: 'No valid updates provided' });
        }

        cleanUpdates.updatedAt = FieldValue.serverTimestamp();
        cleanUpdates.corrected = true;

        await docRef.update(cleanUpdates);

        const updated = await docRef.get();
        res.json({
            id: updated.id,
            ...updated.data(),
            createdAt: updated.data().createdAt?.toDate?.() || updated.data().createdAt,
            updatedAt: new Date()
        });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to update food log');
        res.status(500).json({ error: 'Failed to update food log' });
    }
};

/**
 * Delete a food log
 */
const deleteLog = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { id } = req.params;

        const docRef = db.collection('users').doc(userId).collection('foodLogs').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Food log not found' });
        }

        await docRef.delete();
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
