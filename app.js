/**
 * TalentWave Live : point d'entrée unique (architecture MVC du projet).
 *   config/      environnement, base, e-mail, middlewares, Swagger, utilitaires, démarrage
 *   models/      schémas Mongoose (User, Job, Application, Quiz, QuizAttempt, Interview) + seed
 *   controller/  contrôleurs HTTP + logique métier (services/) + IA (ai/)
 *   routes/      routes Express + validation Joi + tests (Postman)
 *   views/       interface React (source) et gabarits d'e-mails
 *   public/      interface compilée (npm run build), servie ici même
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const routes = require('./routes');
const swaggerSpec = require('./config/swagger/swagger');
const helmetOptions = require('./config/security');
const limits = require('./config/middlewares/rateLimiter');
const { notFound, errorHandler } = require('./config/middlewares/errorHandler');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

// Documentation interactive (avant Helmet pour que Swagger UI garde ses styles en ligne).
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'TalentWave Live API', swaggerOptions: { persistAuthorization: true } }));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

app.use(helmet(helmetOptions(env.isProd)));
app.use(cors({ origin: env.frontendUrl, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
// 8 Mo : la variante JSON accepte un CV ou une réponse audio encodés en base64 (Postman sans fichier joint).
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

app.use('/api', limits.api, routes);

// Interface compilée (public/) : fichiers statiques, puis index.html pour les routes du client (/offres, /quiz/...).
const PUBLIC_DIR = path.join(__dirname, 'public');
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html');
app.use(express.static(PUBLIC_DIR, { index: false, maxAge: env.isProd ? '7d' : 0 }));
app.get(/^\/(?!api(\/|$)|api-docs)/, (req, res, next) => {
  if (!fs.existsSync(INDEX_HTML)) {
    return res.status(404).json({ success: false, code: 'UI_NOT_BUILT', message: 'Interface non compilée : lancez npm run build (ou npm run dev).' });
  }
  res.set('Cache-Control', 'no-cache');
  return res.sendFile(INDEX_HTML, (err) => err && next(err));
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;

// node app.js (npm start / npm run dev) : démarrage réel ; les tests importent app sans démarrer.
if (require.main === module) require('./config/server').start(app);
