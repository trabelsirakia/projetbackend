/** Chatbot du candidat (agent RAG avec outils) et entraînement aux questions d'entretien. */
const asyncHandler = require('../config/utils/asyncHandler');
const chatbot = require('./ai/chatbot');
const env = require('../config/env');

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, ...(message ? { message } : {}), data });

module.exports = {
  message: asyncHandler(async (req, res) => ok(res, await chatbot.chat({ user: req.user, message: req.body.message, history: req.body.history }))),
  practice: (req, res) => ok(res, chatbot.practiceQuestion(req.query.metier)),
  evaluate: asyncHandler(async (req, res) => ok(res, await chatbot.evaluatePractice(req.body.question, req.body.answer, { useLlm: !env.aiOffline }))),
};
