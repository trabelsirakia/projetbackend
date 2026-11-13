/** Tableau de bord global, état des modèles IA, e-mails capturés (instance de test). */
const asyncHandler = require('../config/utils/asyncHandler');
const stats = require('./services/statsService');
const hf = require('./ai/hfModels');
const llm = require('./ai/ollamaClient');
const env = require('../config/env');
const { outbox } = require('../config/mailer');

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, ...(message ? { message } : {}), data });

module.exports = {
  overview: asyncHandler(async (req, res) => ok(res, await stats.overview())),
  ai: asyncHandler(async (req, res) => ok(res, {
    huggingFace: hf.status(), ollama: env.aiOffline ? { disabled: true } : await llm.status(), googleMeet: env.google.configured ? 'Google Meet (API Google Agenda)' : 'Jitsi Meet (Google non configuré)',
  })),
  testMails: (req, res) => ok(res, outbox.slice(-50).reverse()),
};
