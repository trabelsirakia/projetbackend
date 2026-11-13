/** Entretiens (entité 2) : CRUD, statistiques, déroulé avec l'avatar (start / answers / finish), réévaluation, décision. */
const asyncHandler = require('../config/utils/asyncHandler');
const interviews = require('./services/interviewService');
const stats = require('./services/statsService');

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, ...(message ? { message } : {}), data });

module.exports = {
  list: asyncHandler(async (req, res) => ok(res, await interviews.list(req.query, req.user))),
  get: asyncHandler(async (req, res) => ok(res, await interviews.get(req.params.id, req.user))),
  create: asyncHandler(async (req, res) => ok(res, await interviews.create(req.body), 'Entretien planifié.', 201)),
  update: asyncHandler(async (req, res) => ok(res, await interviews.update(req.params.id, req.body), 'Entretien mis à jour.')),
  remove: asyncHandler(async (req, res) => { await interviews.remove(req.params.id); ok(res, null, 'Entretien supprimé.'); }),
  start: asyncHandler(async (req, res) => {
    const out = await interviews.start(req.params.id, req.user, req.body);
    ok(res, out, out.resumed ? 'Reprise de l\'entretien.' : 'Entretien démarré.');
  }),
  answer: asyncHandler(async (req, res) => {
    const out = await interviews.answer(req.params.id, req.user, { ...req.body, audioBuffer: req.file?.buffer });
    ok(res, out, 'Réponse reçue : transcription et analyse en cours.', 202);
  }),
  finish: asyncHandler(async (req, res) => ok(res, await interviews.finish(req.params.id, req.user), 'Entretien terminé.', 202)),
  reevaluate: asyncHandler(async (req, res) => ok(res, await interviews.reevaluate(req.params.id), 'Entretien réévalué.')),
  decide: asyncHandler(async (req, res) => ok(res, await interviews.decide(req.params.id, req.user, req.body), 'Décision enregistrée.')),
  stats: asyncHandler(async (req, res) => ok(res, await interviews.stats(req.query))),
};
