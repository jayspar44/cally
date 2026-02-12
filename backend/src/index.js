require('dotenv').config({ quiet: true });
const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const logger = require('./logger');

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [
        'http://localhost:4000',
        'http://localhost:5173',
        'http://localhost:3500',
        'capacitor://localhost'
    ];

logger.info({ allowedOrigins }, 'Configured Allowed Origins');

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        // Allow requests in development or dev environments
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
            return callback(null, true);
        }

        if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('.ts.net')) {
            callback(null, true);
        } else {
            logger.warn({ origin }, 'Blocked by CORS');
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 200
}));

const apiRoutes = require('./routes/api');

if (process.env.NODE_ENV === 'dev' || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(pinoHttp({
    logger,
    autoLogging: false,
    quietReqLogger: true,
    genReqId: (req) => req.headers['x-cloud-trace-context']?.split('/')[0]
        || req.headers['x-request-id']
        || crypto.randomUUID(),
    serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode })
    }
}));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.send('Backend Running');
});

const PORT = process.env.PORT || 4001;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
    logger.info(`Server running on ${HOST}:${PORT}`);
});
