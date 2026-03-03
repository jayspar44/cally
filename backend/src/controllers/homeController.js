const { generateHomeGreeting } = require('../services/geminiService');
const { safeTimezone } = require('../utils/dateUtils');

const getGreeting = async (req, res) => {
    try {
        const userId = req.user.uid;
        const timezone = safeTimezone(req.query.timezone);

        req.log.info({ action: 'home.getGreeting', timezone }, 'Generating home greeting');

        const result = await generateHomeGreeting(userId, timezone);

        req.log.info({ action: 'home.getGreeting', hasGreeting: !!result.greeting, hasFocus: !!result.activeFocus }, 'Home greeting generated');

        res.json(result);
    } catch (error) {
        req.log.error({ err: error }, 'Failed to generate home greeting');
        res.status(500).json({ error: 'Failed to generate greeting' });
    }
};

module.exports = {
    getGreeting
};
