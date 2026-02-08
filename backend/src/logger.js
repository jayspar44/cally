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

module.exports = logger;
