const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const num = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const handler = (message) => (req, res, next, options) => res.status(options.statusCode).json({ success: false, code: 'RATE_LIMITED', message });
const ipAndEmail = (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email || '').toLowerCase().trim()}`;
const byUser = (req) => (req.user ? `user:${req.user._id}` : ipKeyGenerator(req.ip));
const common = { standardHeaders: 'draft-7', legacyHeaders: false };

module.exports = {
  // Limite générale de l'API.
  api: rateLimit({ ...common, windowMs: 15 * 60000, limit: num('RATE_LIMIT_API_MAX', 2000), handler: handler('Trop de requêtes. Réessayez dans quelques minutes.') }),
  // Connexion : seuls les échecs comptent, par IP + e-mail (anti force brute).
  login: rateLimit({ ...common, windowMs: 15 * 60000, limit: num('RATE_LIMIT_LOGIN_MAX', 10), skipSuccessfulRequests: true, keyGenerator: ipAndEmail, handler: handler('Trop de tentatives de connexion échouées. Réessayez dans 15 minutes.') }),
  signup: rateLimit({ ...common, windowMs: 60 * 60000, limit: num('RATE_LIMIT_SIGNUP_MAX', 30), handler: handler('Trop d\'inscriptions depuis cette adresse. Réessayez plus tard.') }),
  forgot: rateLimit({ ...common, windowMs: 15 * 60000, limit: num('RATE_LIMIT_FORGOT_MAX', 5), keyGenerator: ipAndEmail, handler: handler('Trop de demandes de réinitialisation. Réessayez dans 15 minutes.') }),
  apply: rateLimit({ ...common, windowMs: 10 * 60000, limit: num('RATE_LIMIT_APPLY_MAX', 20), keyGenerator: byUser, handler: handler('Trop de candidatures envoyées. Patientez quelques minutes.') }),
  // IA générative locale (GPU portable) : bornée par utilisateur.
  ai: rateLimit({ ...common, windowMs: 5 * 60000, limit: num('RATE_LIMIT_AI_MAX', 15), keyGenerator: byUser, handler: handler('Trop de générations IA demandées. Patientez quelques minutes.') }),
  chat: rateLimit({ ...common, windowMs: 5 * 60000, limit: num('RATE_LIMIT_CHAT_MAX', 30), keyGenerator: byUser, handler: handler('Vous envoyez beaucoup de messages à l\'assistant. Patientez quelques minutes.') }),
};
