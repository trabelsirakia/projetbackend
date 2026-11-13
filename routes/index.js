/**
 * Routes de l'API (préfixe /api). Chaque route : authentification → rôle → validation Joi → contrôleur.
 */
const router = require('express').Router();
const mongoose = require('mongoose');
const multer = require('multer');
const env = require('../config/env');
const { authenticate, optionalAuth } = require('../config/middlewares/auth');
const { authorize } = require('../config/middlewares/role');
const validate = require('../config/middlewares/validate');
const limits = require('../config/middlewares/rateLimiter');
const AppError = require('../config/utils/AppError');
const S = require('./validators/schemas');
const auth = require('../controller/authController');
const {
  users, jobs, applications, quizzes, interviews, chatbot, stats, system,
} = require('../controller');

const staff = authorize('recruteur', 'admin');
const candidate = authorize('candidat');
const byId = validate(S.params.id, 'params');

// Fichiers en mémoire : CV PDF (5 Mo) et réponses audio WAV (12 Mo ≈ 6 min en 16 kHz mono).
const upload = (field, maxBytes, accept) => (req, res, next) => multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 1 },
  fileFilter: (r, file, cb) => (accept.test(file.mimetype) || accept.test(file.originalname) ? cb(null, true) : cb(new AppError(`Format de fichier refusé (${file.mimetype}).`, 415, 'UNSUPPORTED_FILE'))),
}).single(field)(req, res, (err) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return next(new AppError(`Fichier trop volumineux : ${Math.round(maxBytes / 1048576)} Mo maximum.`, 413, 'PAYLOAD_TOO_LARGE'));
  if (err instanceof multer.MulterError) return next(new AppError(`Envoi de fichier invalide (${err.code}).`, 400, 'UPLOAD_ERROR'));
  return next(err);
});

/**
 * Variante JSON des envois de fichiers (Postman, clients mobiles) : { cvBase64, cvFileName } ou { audioBase64 }.
 * Le fichier décodé suit exactement le même chemin que l'envoi multipart (mêmes contrôles de format et de taille).
 */
const fromBase64 = (field, maxBytes, defaultName) => (req, res, next) => {
  const encoded = req.body?.[`${field}Base64`];
  if (req.file || !encoded) return next();
  const buffer = Buffer.from(String(encoded).replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!buffer.length) return next(new AppError(`${field}Base64 n'est pas un contenu base64 valide.`, 422, 'VALIDATION_ERROR'));
  if (buffer.length > maxBytes) return next(new AppError(`Fichier trop volumineux : ${Math.round(maxBytes / 1048576)} Mo maximum.`, 413, 'PAYLOAD_TOO_LARGE'));
  req.file = { buffer, originalname: req.body[`${field}FileName`] || defaultName, size: buffer.length };
  delete req.body[`${field}Base64`];
  return next();
};

router.get('/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ success: dbUp, data: { status: dbUp ? 'ok' : 'degraded', database: dbUp ? 'connectée' : 'déconnectée', uptime: Math.round(process.uptime()) } });
});

// ---------- Authentification ----------
router.post('/auth/signup', limits.signup, validate(S.auth.signup), auth.signup);
router.post('/auth/login', limits.login, validate(S.auth.login), auth.login);
router.post('/auth/refresh', validate(S.auth.refresh), auth.refresh);
router.post('/auth/logout', authenticate, auth.logout);
router.post('/auth/forgot-password', limits.forgot, validate(S.auth.forgot), auth.forgotPassword);
router.post('/auth/reset-password', validate(S.auth.reset), auth.resetPassword);
router.get('/auth/me', authenticate, auth.me);
router.patch('/auth/me', authenticate, validate(S.auth.updateMe), auth.updateMe);
router.post('/auth/change-password', authenticate, validate(S.auth.changePassword), auth.changePassword);

// ---------- Utilisateurs (admin) ----------
router.get('/users', authenticate, authorize('admin'), validate(S.users.list, 'query'), users.list);
router.post('/users', authenticate, authorize('admin'), validate(S.users.create), users.create);
router.patch('/users/:id', authenticate, authorize('admin'), byId, validate(S.users.update), users.update);
router.delete('/users/:id', authenticate, authorize('admin'), byId, users.remove);

// ---------- Métiers et offres ----------
router.get('/metiers', jobs.metiers);
router.get('/jobs', optionalAuth, validate(S.jobs.list, 'query'), jobs.list);
router.get('/jobs/:id', optionalAuth, byId, jobs.get);
router.post('/jobs', authenticate, staff, validate(S.jobs.create), jobs.create);
router.patch('/jobs/:id', authenticate, staff, byId, validate(S.jobs.update), jobs.update);
router.delete('/jobs/:id', authenticate, staff, byId, jobs.remove);

// ---------- Candidatures (le bouton « Postuler ») ----------
router.post('/applications', authenticate, candidate, limits.apply, upload('cv', 5 * 1048576, /pdf$/i), fromBase64('cv', 5 * 1048576, 'cv.pdf'), validate(S.applications.apply), applications.apply);
router.get('/applications', authenticate, validate(S.applications.list, 'query'), applications.list);
router.get('/applications/:id', authenticate, byId, applications.get);
router.get('/applications/:id/cv', authenticate, byId, applications.cv);
router.post('/applications/:id/invite', authenticate, staff, byId, applications.invite);
router.post('/applications/:id/reject', authenticate, staff, byId, validate(S.applications.reject), applications.reject);
router.post('/applications/:id/withdraw', authenticate, candidate, byId, applications.withdraw);
router.get('/applications/:id/quiz', authenticate, candidate, byId, applications.quizOverview);
router.post('/applications/:id/quiz/start', authenticate, candidate, byId, applications.quizStart);

// ---------- Quiz (entité 1) ----------
router.get('/quizzes/stats', authenticate, staff, validate(S.quizzes.stats, 'query'), quizzes.stats);
router.post('/quizzes/generate', authenticate, staff, limits.ai, validate(S.quizzes.generate), quizzes.generate);
router.get('/quizzes', authenticate, staff, validate(S.quizzes.list, 'query'), quizzes.list);
router.post('/quizzes', authenticate, staff, validate(S.quizzes.create), quizzes.create);
router.get('/quizzes/:id', authenticate, staff, byId, quizzes.get);
router.patch('/quizzes/:id', authenticate, staff, byId, validate(S.quizzes.update), quizzes.update);
router.delete('/quizzes/:id', authenticate, staff, byId, quizzes.remove);
router.post('/quizzes/:id/duplicate', authenticate, staff, byId, quizzes.duplicate);
router.get('/quizzes/:id/attempts', authenticate, staff, byId, validate(S.quizzes.attempts, 'query'), quizzes.attempts);
router.post('/quiz-attempts/:id/submit', authenticate, candidate, byId, validate(S.quizzes.submit), quizzes.submit);
router.get('/quiz-attempts/:id', authenticate, byId, quizzes.getAttempt);

// ---------- Entretiens (entité 2) ----------
router.get('/interviews/stats', authenticate, staff, validate(S.interviews.stats, 'query'), interviews.stats);
router.get('/interviews', authenticate, validate(S.interviews.list, 'query'), interviews.list);
router.post('/interviews', authenticate, staff, validate(S.interviews.create), interviews.create);
router.get('/interviews/:id', authenticate, byId, interviews.get);
router.patch('/interviews/:id', authenticate, staff, byId, validate(S.interviews.update), interviews.update);
router.delete('/interviews/:id', authenticate, staff, byId, interviews.remove);
router.post('/interviews/:id/start', authenticate, candidate, byId, validate(S.interviews.start), interviews.start);
router.post('/interviews/:id/answers', authenticate, candidate, byId, upload('audio', 12 * 1048576, /(wav|wave)$/i), fromBase64('audio', 12 * 1048576, 'reponse.wav'), validate(S.interviews.answer), interviews.answer);
router.post('/interviews/:id/finish', authenticate, candidate, byId, interviews.finish);
router.post('/interviews/:id/evaluate', authenticate, staff, byId, limits.ai, interviews.reevaluate);
router.post('/interviews/:id/decision', authenticate, staff, byId, validate(S.interviews.decision), interviews.decide);

// ---------- Chatbot ----------
router.post('/chatbot/message', authenticate, limits.chat, validate(S.chatbot.message), chatbot.message);
router.get('/chatbot/practice', authenticate, validate(S.chatbot.practice, 'query'), chatbot.practice);
router.post('/chatbot/practice/evaluate', authenticate, limits.chat, validate(S.chatbot.evaluate), chatbot.evaluate);

// ---------- Tableau de bord, IA, e-mails de test ----------
router.get('/stats/overview', authenticate, staff, stats.overview);
router.get('/system/ai', authenticate, staff, system.ai);
if ((process.env.MAIL_CAPTURE === '1' || process.env.MAIL_JOURNAL === '1') && !env.isProd) {
  // Instance de test Postman uniquement : e-mails capturés, ou réellement envoyés et journalisés (liens, accusé SMTP).
  router.get('/test-mails', system.testMails);
}

module.exports = router;
