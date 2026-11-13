/** Quiz (entité 1) : CRUD, génération IA, statistiques, passages, envoi des réponses. */
const asyncHandler = require('../config/utils/asyncHandler');
const quizzes = require('./services/quizService');
const stats = require('./services/statsService');

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, ...(message ? { message } : {}), data });

module.exports = {
  list: asyncHandler(async (req, res) => ok(res, await quizzes.list(req.query))),
  get: asyncHandler(async (req, res) => ok(res, await quizzes.get(req.params.id))),
  create: asyncHandler(async (req, res) => ok(res, await quizzes.create(req.body, req.user), 'Quiz créé.', 201)),
  update: asyncHandler(async (req, res) => ok(res, await quizzes.update(req.params.id, req.body), 'Quiz mis à jour.')),
  remove: asyncHandler(async (req, res) => { await quizzes.remove(req.params.id); ok(res, null, 'Quiz supprimé.'); }),
  duplicate: asyncHandler(async (req, res) => ok(res, await quizzes.duplicate(req.params.id, req.user), 'Quiz dupliqué (inactif).', 201)),
  generate: asyncHandler(async (req, res) => {
    const out = await quizzes.generate(req.body, req.user);
    ok(res, out, `${out.quiz.questions.length} questions générées : relisez le quiz puis activez-le.`, 201);
  }),
  stats: asyncHandler(async (req, res) => ok(res, await quizzes.stats(req.query))),
  attempts: asyncHandler(async (req, res) => ok(res, await quizzes.attemptsOf(req.params.id, req.query))),
  submit: asyncHandler(async (req, res) => {
    const out = await quizzes.submit(req.params.id, req.body.answers, req.user);
    ok(res, out, `Quiz envoyé : ${out.attempt.percent}/100${out.attempt.status === 'expiree' ? ' (temps dépassé)' : ''}.`);
  }),
  getAttempt: asyncHandler(async (req, res) => ok(res, await quizzes.getAttempt(req.params.id, req.user))),
};
