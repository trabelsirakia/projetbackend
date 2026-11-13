/** Offres d'emploi et catalogue des métiers. */
const asyncHandler = require('../config/utils/asyncHandler');
const jobs = require('./services/jobService');
const { METIERS } = require('./ai/data/metiers');

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, ...(message ? { message } : {}), data });

module.exports = {
  list: asyncHandler(async (req, res) => ok(res, await jobs.list(req.query, req.user))),
  get: asyncHandler(async (req, res) => ok(res, await jobs.get(req.params.id, req.user))),
  create: asyncHandler(async (req, res) => ok(res, await jobs.create(req.body, req.user), 'Offre créée.', 201)),
  update: asyncHandler(async (req, res) => ok(res, await jobs.update(req.params.id, req.body, req.user), 'Offre mise à jour.')),
  remove: asyncHandler(async (req, res) => { await jobs.remove(req.params.id, req.user); ok(res, null, 'Offre supprimée.'); }),
  metiers: (req, res) => ok(res, Object.entries(METIERS).map(([key, m]) => ({
    key, label: m.label, weights: m.weights, skills: m.skills.map((s) => s.name), quizBankSize: m.quizBank.length, interviewQuestions: m.interview.length,
  }))),
};
