const express = require('express');
const router = express.Router();
const pkg = require('../../package.json');
const { verifyToken } = require('../controllers/authController');
const { updateProfile, getProfile } = require('../controllers/userController');
const { sendMessage, getHistory, clearHistory, deleteMessage } = require('../controllers/chatController');
const { getLogs, getLog, createLog, updateLog, deleteLog } = require('../controllers/foodController');
const { getDailySummary, getWeeklyTrends, getMonthlyTrends } = require('../controllers/insightsController');

const serverStartTime = new Date().toISOString();

router.get('/health', (req, res) => res.json({
    status: 'OK',
    version: pkg.version,
    serverStartTime
}));

router.use(verifyToken);

router.post('/user/profile', updateProfile);
router.get('/user/profile', getProfile);

router.post('/chat/message', sendMessage);
router.get('/chat/history', getHistory);
router.delete('/chat/history', clearHistory);
router.delete('/chat/message/:id', deleteMessage);

router.get('/food/logs', getLogs);
router.get('/food/logs/:id', getLog);
router.post('/food/logs', createLog);
router.put('/food/logs/:id', updateLog);
router.delete('/food/logs/:id', deleteLog);

router.get('/insights/daily/:date', getDailySummary);
router.get('/insights/weekly', getWeeklyTrends);
router.get('/insights/monthly', getMonthlyTrends);

module.exports = router;
