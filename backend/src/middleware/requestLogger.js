const crypto = require('node:crypto');
const { runWithContext } = require('../requestContext');

const getRequestId = (req) =>
    req.headers['x-cloud-trace-context']?.split('/')[0]
    || req.headers['x-request-id']
    || crypto.randomUUID();

const requestLogger = (req, res, next) => {
    const requestId = getRequestId(req);
    const userId = req.user?.uid;
    const startTime = Date.now();

    req.log = req.log.child({ userId, requestId });

    req.log.info({
        action: 'request.start',
        method: req.method,
        path: req.originalUrl
    }, 'Request started');

    res.on('finish', () => {
        req.log.info({
            action: 'request.complete',
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - startTime
        }, 'Request completed');
    });

    runWithContext({ userId, requestId }, () => next());
};

module.exports = { requestLogger };
