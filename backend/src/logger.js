const pino = require('pino');

const isLocalDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    ...(isLocalDev && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                ignore: 'pid,hostname',
                translateTime: 'HH:MM:ss'
            }
        }
    }),
    ...(!isLocalDev && {
        formatters: {
            level: (label) => ({ level: label })
        },
        timestamp: () => `,"time":"${new Date().toISOString()}"`
    })
});

const { getRequestContext } = require('./requestContext');

const getLogger = () => {
    const ctx = getRequestContext();
    if (ctx.userId) return logger.child({ userId: ctx.userId, requestId: ctx.requestId });
    return logger;
};

module.exports = logger;
module.exports.getLogger = getLogger;
