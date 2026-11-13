/** Candidatures : le bouton « Postuler » (CV PDF → matching IA → invitation ou refus), suivi, CV, décisions du recruteur, accès au quiz. */
const asyncHandler = require('../config/utils/asyncHandler');
const applications = require('./services/applicationService');
const quizzes = require('./services/quizService');

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, ...(message ? { message } : {}), data });

module.exports = {
  apply: asyncHandler(async (req, res) => {
    const app = await applications.apply({ user: req.user, jobId: req.body.jobId, file: req.file, coverLetter: req.body.coverLetter });
    const invited = app.status === 'invitee';
    ok(res, app, invited
      ? `Score de correspondance ${app.matching.score}/100 : vous êtes invité·e en entretien ! Un e-mail vient de vous être envoyé.`
      : `Score de correspondance ${app.matching.score}/100 : votre candidature n'atteint pas le seuil de ce poste. Un e-mail explique pourquoi.`, 201);
  }),
  list: asyncHandler(async (req, res) => ok(res, await applications.list(req.query, req.user))),
  get: asyncHandler(async (req, res) => ok(res, await applications.get(req.params.id, req.user))),
  cv: asyncHandler(async (req, res) => {
    const app = await applications.cv(req.params.id, req.user);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${encodeURIComponent(app.cvFileName)}"`, 'Cache-Control': 'no-store' });
    res.send(app.cvFile);
  }),
  invite: asyncHandler(async (req, res) => ok(res, await applications.forceInvite(req.params.id), 'Candidat invité : e-mail d\'acceptation envoyé.')),
  reject: asyncHandler(async (req, res) => ok(res, await applications.reject(req.params.id, req.body.note), 'Candidature refusée.')),
  withdraw: asyncHandler(async (req, res) => ok(res, await applications.withdraw(req.params.id, req.user), 'Candidature retirée.')),
  quizOverview: asyncHandler(async (req, res) => ok(res, await quizzes.overview(req.params.id, req.user))),
  quizStart: asyncHandler(async (req, res) => ok(res, await quizzes.start(req.params.id, req.user), 'Quiz démarré : bonne chance !', 201)),
};
