const express = require('express');
const router = express.Router();

// Capture at module load - updates when nodemon restarts
const serverStartTime = new Date().toISOString();
const pkg = require('../../package.json');
const { verifyToken } = require('../controllers/authController');

// Health check (public - returns version and server start time)
router.get('/health', (req, res) => res.json({
    status: 'OK',
    version: pkg.version,
    serverStartTime
}));

// Protected Routes
router.use(verifyToken);

// User Profile
const { updateProfile, getProfile } = require('../controllers/userController');
router.post('/user/profile', updateProfile);
router.get('/user/profile', getProfile);

// Chat
const { sendMessage, getHistory, clearHistory } = require('../controllers/chatController');
router.post('/chat/message', sendMessage);
router.get('/chat/history', getHistory);
router.delete('/chat/history', clearHistory);

// Food Logs
const { getLogs, getLog, createLog, updateLog, deleteLog } = require('../controllers/foodController');
router.get('/food/logs', getLogs);
router.get('/food/logs/:id', getLog);
router.post('/food/logs', createLog);
router.put('/food/logs/:id', updateLog);
router.delete('/food/logs/:id', deleteLog);

// Insights
const { getDailySummary, getWeeklyTrends, getMonthlyTrends } = require('../controllers/insightsController');
router.get('/insights/daily/:date', getDailySummary);
router.get('/insights/weekly', getWeeklyTrends);
router.get('/insights/monthly', getMonthlyTrends);

module.exports = router;
