const path = require('path');
const Joi = require('joi');

/**
 * Chargement du .env racine. Le .env du projet l'emporte sur les variables système homonymes,
 * sauf quelques réglages d'exécution surchargeables au lancement (tests, instance Postman isolée).
 */
const OVERRIDABLE = /^(NODE_ENV|PORT|MONGODB_URI|OLLAMA_HOST|FRONTEND_URL|TRUST_PROXY|ACCESS_TOKEN_EXPIRY|MAIL_CAPTURE|MAIL_JOURNAL|AI_OFFLINE|RATE_LIMIT_\w+)$/;
const parsed = require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true }).parsed || {};
for (const [key, fileValue] of Object.entries(parsed)) {
  if (OVERRIDABLE.test(key) && process.env[key] !== undefined && process.env[key] !== fileValue) continue;
  process.env[key] = fileValue;
}

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(8200),
  MONGODB_URI: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] }).required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required().invalid(Joi.ref('JWT_SECRET'))
    .messages({ 'any.invalid': 'JWT_REFRESH_SECRET doit être différent de JWT_SECRET' }),
  ACCESS_TOKEN_EXPIRY: Joi.string().default('15m'),
  REFRESH_TOKEN_EXPIRY: Joi.string().default('7d'),
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_USER: Joi.string().required(),
  SMTP_PASSWORD: Joi.string().required(),
  MAIL_FROM: Joi.string().required(),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:5175'),
  OLLAMA_HOST: Joi.string().uri().default('http://localhost:11434'),
  OLLAMA_MODEL: Joi.string().default('llama3.1:8b'),
  WHISPER_MODEL: Joi.string().default('Xenova/whisper-small'),
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  GOOGLE_REFRESH_TOKEN: Joi.string().allow('').default(''),
}).unknown(true);

const { value, error } = schema.validate(process.env, { abortEarly: false });
if (error) {
  console.error(`\n[config] Fichier .env invalide :\n${error.details.map((d) => `  - ${d.message}`).join('\n')}\n`);
  process.exit(1);
}

module.exports = Object.freeze({
  nodeEnv: value.NODE_ENV,
  isProd: value.NODE_ENV === 'production',
  isTest: value.NODE_ENV === 'test',
  port: value.PORT,
  mongoUri: value.MONGODB_URI,
  jwt: {
    accessSecret: value.JWT_SECRET,
    refreshSecret: value.JWT_REFRESH_SECRET,
    accessExpiry: value.ACCESS_TOKEN_EXPIRY,
    refreshExpiry: value.REFRESH_TOKEN_EXPIRY,
  },
  smtp: {
    host: value.SMTP_HOST,
    port: value.SMTP_PORT,
    user: value.SMTP_USER.trim(),
    password: /gmail\.com$/i.test(value.SMTP_HOST.trim()) ? value.SMTP_PASSWORD.replace(/\s+/g, '') : value.SMTP_PASSWORD,
    from: value.MAIL_FROM.trim(),
  },
  frontendUrl: value.FRONTEND_URL.replace(/\/$/, ''),
  ollama: {
    host: value.OLLAMA_HOST.replace(/\/$/, '').replace('://localhost', '://127.0.0.1'),
    model: value.OLLAMA_MODEL,
    embedModel: 'nomic-embed-text',
  },
  // AI_OFFLINE=1 : le LLM n'est jamais appelé (tests rapides) ; les modèles Hugging Face restent utilisés.
  aiOffline: process.env.AI_OFFLINE === '1',
  whisperModel: value.WHISPER_MODEL,
  google: {
    clientId: value.GOOGLE_CLIENT_ID,
    clientSecret: value.GOOGLE_CLIENT_SECRET,
    refreshToken: value.GOOGLE_REFRESH_TOKEN,
    configured: Boolean(value.GOOGLE_CLIENT_ID && value.GOOGLE_CLIENT_SECRET && value.GOOGLE_REFRESH_TOKEN),
  },
});
