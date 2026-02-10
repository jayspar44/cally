const { db } = require('../services/firebase');
const { toDateStr, getTodayStr } = require('../utils/dateUtils');
const { DEFAULT_GOALS, snapshotGoals } = require('../services/goalsService');

const DEFAULT_SETTINGS = {
    ...DEFAULT_GOALS,
    timezone: 'America/New_York',
    notificationsEnabled: true
};

const updateProfile = async (req, res) => {
    try {
        const { uid, email } = req.user;
        const { firstName, settings } = req.body;

        req.log.info({
            action: 'user.updateProfile',
            settingKeys: settings ? Object.keys(settings) : []
        }, 'Updating user profile');

        if (!uid) {
            return res.status(400).json({ error: 'User ID missing from token' });
        }

        const userDoc = await db.collection('users').doc(uid).get();
        const userData = {
            email,
            updatedAt: new Date().toISOString()
        };

        if (!userDoc.exists) {
            userData.registeredDate = toDateStr();
            userData.settings = {
                ...DEFAULT_SETTINGS,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
            };
        }

        if (firstName !== undefined) {
            userData.firstName = firstName;
        }

        if (settings) {
            const existingSettings = userDoc.exists ? (userDoc.data().settings || {}) : (userData.settings || {});
            userData.settings = { ...existingSettings, ...settings };

            const today = getTodayStr(userData.settings.timezone || DEFAULT_SETTINGS.timezone);
            await snapshotGoals(uid, today, userData.settings);
        }

        await db.collection('users').doc(uid).set(userData, { merge: true });

        req.log.info({ action: 'user.updateProfile' }, 'User profile updated');

        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        req.log.error({ err: error }, 'Error updating profile');
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

const getProfile = async (req, res) => {
    try {
        const { uid } = req.user;

        req.log.info({ action: 'user.getProfile' }, 'Fetching user profile');

        const doc = await db.collection('users').doc(uid).get();

        if (!doc.exists) {
            req.log.info({ action: 'user.getProfile', profileExists: false }, 'Profile fetched (default)');
            return res.json({
                firstName: '',
                email: req.user.email,
                registeredDate: toDateStr(),
                settings: DEFAULT_SETTINGS
            });
        }

        req.log.info({ action: 'user.getProfile', profileExists: true }, 'Profile fetched');

        const data = doc.data();
        res.json({
            firstName: data.firstName || '',
            email: data.email || req.user.email,
            registeredDate: data.registeredDate || data.updatedAt?.split('T')[0] || toDateStr(),
            settings: data.settings || DEFAULT_SETTINGS
        });
    } catch (error) {
        req.log.error({ err: error }, 'Error fetching profile');
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

module.exports = {
    updateProfile,
    getProfile
};
