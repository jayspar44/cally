const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const pkg = require('../../package.json');
const { verifyToken } = require('../controllers/authController');
const { updateProfile, getProfile, getRecommendedTargets, getBadges } = require('../controllers/userController');
const { sendMessage, getHistory, clearHistory, deleteMessage } = require('../controllers/chatController');
const { getLogs, getLog, createLog, updateLog, deleteLog } = require('../controllers/foodController');
const { getDailySummary, getWeeklyTrends, getMonthlyTrends, getQuarterlyTrends, getAISummary } = require('../controllers/insightsController');

const aiRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user?.uid || req.ip,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many AI requests, please try again in a minute.' }
});

const serverStartTime = new Date().toISOString();

router.get('/health', (req, res) => res.json({
    status: 'OK',
    version: pkg.version,
    serverStartTime
}));

router.use(verifyToken);
router.use(require('../middleware/requestLogger').requestLogger);

router.post('/user/profile', updateProfile);
router.get('/user/profile', getProfile);
router.get('/user/recommended-targets', getRecommendedTargets);
router.get('/user/badges', getBadges);

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
router.get('/insights/quarterly', getQuarterlyTrends);
router.get('/insights/ai-summary', aiRateLimit, getAISummary);

module.exports = router;
