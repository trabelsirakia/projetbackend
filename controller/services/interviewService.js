/**
 * ENTRETIEN : CRUD recruteur (recherche, filtres, tri, pagination, statistiques) + déroulé en direct avec l'avatar.
 *
 * Déroulé côté candidat :
 *   start   → vérifie (quiz passé, non expiré), construit les 5 questions pour CE candidat (interviewPlanner) ;
 *   answer  → réponse orale (WAV) ou écrite ; renvoie 202 tout de suite : transcription Whisper + notation
 *             s'exécutent en file (une par entretien) pendant que l'avatar pose la question suivante ;
 *   finish  → attend la fin de la file, calcule le résultat (evaluator), prévient le recruteur.
 * Garde-fous : un entretien dépassant sa durée + 2 min est clôturé ; une question ne reçoit qu'une réponse ;
 * une tâche périodique expire les entretiens non passés et clôture ceux abandonnés en cours.
 */
const Interview = require('../../models/Interview');
const Application = require('../../models/Application');
const QuizAttempt = require('../../models/QuizAttempt');
const User = require('../../models/User');
const Job = require('../../models/Job');
const AppError = require('../../config/utils/AppError');
const env = require('../../config/env');
const logger = require('../../config/utils/logger');
const { paginate, compact, range } = require('../../config/utils/listQuery');
const planner = require('../ai/interviewPlanner');
const scorer = require('../ai/answerScorer');
const evaluator = require('../ai/evaluator');
const hf = require('../ai/hfModels');
const audio = require('../ai/audio');
const { metierLabel } = require('../ai/data/metiers');
const { wordCount } = require('../ai/textUtils');
const meet = require('./meetService');
const mail = require('./emailService');
const appService = require('./applicationService');

const OVERTIME_MS = 2 * 60000;
const useLlm = () => !env.aiOffline;

const notFound = () => new AppError('Entretien introuvable.', 404, 'INTERVIEW_NOT_FOUND');

// ---------- File de traitement par entretien (transcription + notation dans l'ordre d'arrivée) ----------
const queues = new Map();
function enqueue(id, task) {
  const key = String(id);
  const prev = queues.get(key) || Promise.resolve();
  const next = prev.then(task).catch((err) => logger.error(`Entretien ${key} : traitement d'une réponse en échec : ${err.message}`));
  queues.set(key, next);
  next.finally(() => { if (queues.get(key) === next) queues.delete(key); });
  return next;
}
const drained = (id) => queues.get(String(id)) || Promise.resolve();

/** Langue de la transcription par mots-outils (fr / en), sans dépendre de la langue demandée. */
function detectLanguage(text) {
  const t = ` ${text.toLowerCase()} `;
  const fr = (t.match(/ (je|le|la|les|et|est|une|des|pour|avec|dans|que|qui|nous|vous|j'ai|c'est) /g) || []).length;
  const en = (t.match(/ (i|the|and|is|a|of|to|with|in|that|we|you|my|i'm|it's|have) /g) || []).length;
  if (!fr && !en) return 'inconnue';
  return fr >= en ? 'fr' : 'en';
}

// ---------- Vues ----------
/** Ce que voit le candidat : jamais les grilles d'attendus avant l'évaluation. */
function candidateView(itv) {
  const json = itv.toJSON();
  const evaluated = itv.status === 'evalue';
  json.questions = (json.questions || []).map((q) => (evaluated ? q : { order: q.order, type: q.type, skill: q.skill, text: q.text, timeLimitSec: q.timeLimitSec }));
  if (!evaluated) {
    delete json.evaluation;
    json.answers = (json.answers || []).map((a) => ({ questionIndex: a.questionIndex, transcript: a.transcript, inputMode: a.inputMode, durationSec: a.durationSec }));
  }
  json.decision = itv.decision?.value && itv.decision.value !== 'en_attente' ? { value: itv.decision.value, comment: itv.decision.comment, at: itv.decision.at } : { value: 'en_attente' };
  json.answeredCount = itv.answers.length;
  return json;
}

async function load(id, user) {
  const itv = await Interview.findById(id).populate('job', 'title metier location').populate('candidate', 'firstName lastName email');
  if (!itv) throw notFound();
  if (user.role === 'candidat' && String(itv.candidate._id) !== String(user._id)) throw notFound();
  return itv;
}

async function get(id, user) {
  const itv = await load(id, user);
  await autoClose(itv);
  return user.role === 'candidat' ? candidateView(itv) : itv;
}

// ---------- CRUD recruteur ----------
const SORTS = ['createdAt', 'scheduledAt', 'status', 'evaluation.overall', 'candidateName', 'title', 'startedAt'];

async function list(query, user) {
  const base = user.role === 'candidat' ? { candidate: user._id } : {};
  if (user.role === 'recruteur' && query.mine === 'true') base.job = { $in: await Job.find({ recruiter: user._id }).distinct('_id') };
  const res = await paginate(Interview, query, {
    searchFields: ['title', 'candidateName', 'evaluation.summary'],
    sortFields: SORTS,
    defaultSort: '-scheduledAt',
    baseFilter: base,
    filters: (q) => compact({
      status: q.status,
      metier: q.metier,
      job: q.job,
      language: q.language,
      'meet.provider': q.provider,
      'evaluation.recommendation': q.recommendation,
      'decision.value': q.decision,
      'evaluation.overall': range(q.minScore, q.maxScore),
      scheduledAt: range(q.from, q.to, (d) => new Date(d)),
    }),
    select: '-answers.coveredPoints -answers.missedPoints -questions.keyPoints',
    populate: [{ path: 'job', select: 'title' }],
  });
  if (user.role === 'candidat') res.items = res.items.map(candidateView);
  return res;
}

/** Création manuelle par le recruteur à partir d'une candidature (invite si besoin). */
async function create({ application: applicationId, scheduledAt, expiresAt, language, durationMinutes, recruiterNotes }) {
  const app = await Application.findById(applicationId).populate('job').populate('candidate');
  if (!app) throw new AppError('Candidature introuvable.', 404, 'APPLICATION_NOT_FOUND');
  if (await Interview.exists({ application: app._id })) throw new AppError('Un entretien existe déjà pour cette candidature.', 409, 'INTERVIEW_EXISTS');
  if (['soumise', 'refusee'].includes(app.status)) {
    await appService.invite(app, { by: 'recruteur', note: 'Entretien créé par le recruteur' });
  } else {
    const meeting = await meet.createMeeting({ title: `Entretien — ${app.job.title}`, description: 'Entretien vidéo TalentWave Live', start: new Date(scheduledAt || Date.now() + 86400000), durationMinutes: durationMinutes || 5, attendees: [app.candidate.email] });
    const itv = await Interview.create({
      application: app._id, candidate: app.candidate._id, candidateName: `${app.candidate.firstName} ${app.candidate.lastName}`, job: app.job._id, metier: app.job.metier,
      title: `Entretien — ${app.job.title}`, scheduledAt: scheduledAt || appService.proposedSlot(), expiresAt: expiresAt || new Date(Date.now() + 7 * 86400000), language: language || 'fr', meet: meeting,
    });
    app.interview = itv._id;
    await app.save();
  }
  const itv = await Interview.findOne({ application: app._id });
  Object.assign(itv, compact({ scheduledAt, expiresAt, language, durationMinutes, recruiterNotes }));
  return itv.save();
}

const EDITABLE_WHEN = { planifie: ['scheduledAt', 'expiresAt', 'language', 'durationMinutes', 'recruiterNotes', 'avatar', 'status'], default: ['recruiterNotes'] };

async function update(id, data) {
  const itv = await Interview.findById(id);
  if (!itv) throw notFound();
  const allowed = EDITABLE_WHEN[itv.status] || EDITABLE_WHEN.default;
  const refused = Object.keys(data).filter((k) => !allowed.includes(k));
  if (refused.length) throw new AppError(`Champs non modifiables au statut « ${itv.status} » : ${refused.join(', ')}.`, 409, 'INTERVIEW_LOCKED');
  if (data.status && !['planifie', 'annule'].includes(data.status)) throw new AppError('Seule l\'annulation est possible ici.', 409, 'INVALID_STATUS');
  if (data.expiresAt && new Date(data.expiresAt) <= new Date(data.scheduledAt || itv.scheduledAt)) throw new AppError('La date limite doit suivre le créneau.', 422, 'VALIDATION_ERROR');
  Object.assign(itv, data);
  await itv.save();
  if (data.status === 'annule') await meet.cancelMeeting(itv.meet);
  return itv;
}

async function remove(id) {
  const itv = await Interview.findById(id);
  if (!itv) throw notFound();
  if (itv.status === 'en_cours') throw new AppError('Entretien en cours : impossible de le supprimer maintenant.', 409, 'INTERVIEW_RUNNING');
  await meet.cancelMeeting(itv.meet);
  await Application.updateOne({ _id: itv.application }, { interview: null });
  await itv.deleteOne();
}

// ---------- Déroulé (candidat) ----------
async function start(id, user, { language } = {}) {
  const itv = await load(id, user);
  if (String(itv.candidate._id) !== String(user._id)) throw new AppError('Seul le candidat peut passer son entretien.', 403, 'FORBIDDEN');
  await autoClose(itv);
  if (itv.status === 'en_cours') return { interview: candidateView(itv), resumed: true };
  if (itv.status !== 'planifie') throw new AppError(`Cet entretien n'est plus disponible (statut : ${itv.status}).`, 409, 'INVALID_STATUS');
  if (itv.expiresAt < new Date()) throw new AppError('La date limite de cet entretien est dépassée.', 409, 'INTERVIEW_EXPIRED');
  const app = await Application.findById(itv.application);
  if (!app || app.status === 'invitee') throw new AppError('Passez d\'abord le quiz de compétences : l\'entretien s\'appuie sur ses résultats.', 409, 'QUIZ_REQUIRED');
  if (app.status !== 'quiz_termine') throw new AppError('Cette candidature ne permet pas de passer l\'entretien.', 409, 'INVALID_STATUS');

  const job = await Job.findById(itv.job);
  const attempt = app.quizAttempt ? await QuizAttempt.findById(app.quizAttempt) : null;
  if (language) itv.language = language;
  itv.questions = await planner.plan({ job, application: app, quizAttempt: attempt, language: itv.language, useLlm: useLlm() });
  itv.quizAttempt = attempt?._id || null;
  itv.status = 'en_cours';
  itv.startedAt = new Date();
  itv.answers = [];
  await itv.save();
  return { interview: candidateView(itv), resumed: false };
}

async function processAnswer(interviewId, payload) {
  const itv = await Interview.findById(interviewId);
  const q = itv.questions[payload.questionIndex];
  let transcript = payload.transcript || '';
  let inputMode = 'texte';
  let durationSec = payload.durationSec || 0;
  let language = null;
  if (payload.audio) {
    inputMode = 'voix';
    const { samples, durationSec: d } = audio.decodeWav(payload.audio);
    durationSec = Math.round(d);
    if (audio.rms(samples) < 0.004) {
      transcript = ''; // silence : inutile d'appeler Whisper
    } else {
      // Langue détectée par Whisper (fr / en), puis transcription dans cette langue (thread dédié).
      const out = await hf.transcribe(samples, null).catch((err) => { logger.warn(`Whisper : ${err.message}`); return null; });
      transcript = out?.text || payload.liveTranscript || '';
      language = out?.language || null;
      if (out) logger.info(`Whisper : ${durationSec} s d'audio, langue ${out.language} ${JSON.stringify(out.probs)}, détection ${out.detectMs} ms + transcription ${out.transcribeMs} ms (${wordCount(transcript)} mots)`);
      else if (transcript) logger.warn('Whisper indisponible : sous-titres du navigateur utilisés comme transcription.');
    }
  }
  const scored = await scorer.scoreAnswer(q, { transcript, durationSec, inputMode }, { metierLabel: metierLabel(itv.metier), useLlm: useLlm() });
  const answer = {
    questionIndex: payload.questionIndex,
    transcript,
    inputMode,
    detectedLanguage: language || detectLanguage(transcript),
    durationSec,
    wordsPerMinute: scored.wordsPerMinute,
    scores: scored.scores,
    score: scored.score,
    coveredPoints: scored.coveredPoints,
    missedPoints: scored.missedPoints,
    feedback: scored.feedback,
    answeredAt: new Date(),
  };
  // Mise à jour atomique : une question ne peut avoir qu'une réponse, même si deux envois se croisent.
  await Interview.updateOne({ _id: interviewId, 'answers.questionIndex': { $ne: payload.questionIndex } }, { $push: { answers: answer } });
  return answer;
}

const pending = new Map(); // questions reçues mais pas encore enregistrées (évite le double envoi)

async function answer(id, user, { questionIndex, transcript, durationSec, liveTranscript, audioBuffer }) {
  const itv = await load(id, user);
  if (String(itv.candidate._id) !== String(user._id)) throw new AppError('Seul le candidat peut répondre.', 403, 'FORBIDDEN');
  if (itv.status !== 'en_cours') throw new AppError('Cet entretien n\'est pas en cours.', 409, 'INVALID_STATUS');
  if (Date.now() > itv.startedAt.getTime() + itv.durationMinutes * 60000 + OVERTIME_MS) {
    finish(id, user).catch(() => {});
    throw new AppError('Le temps de l\'entretien est écoulé.', 409, 'INTERVIEW_TIME_OVER');
  }
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= itv.questions.length) throw new AppError('Question inconnue.', 422, 'VALIDATION_ERROR');
  const key = `${id}:${questionIndex}`;
  if (itv.answers.some((a) => a.questionIndex === questionIndex) || pending.has(key)) throw new AppError('Cette question a déjà reçu une réponse.', 409, 'ALREADY_ANSWERED');
  if (!audioBuffer && !String(transcript || '').trim()) throw new AppError('Envoyez une réponse orale (audio WAV) ou écrite (transcript).', 422, 'ANSWER_REQUIRED');
  if (audioBuffer) audio.decodeWav(audioBuffer); // contrôle immédiat du format (422 clair)

  pending.set(key, true);
  enqueue(id, () => processAnswer(id, { questionIndex, transcript, durationSec, liveTranscript, audio: audioBuffer }).finally(() => pending.delete(key)));
  return { queued: true, questionIndex, remaining: itv.questions.length - itv.answers.length - 1 };
}

async function finalizeEvaluation(id) {
  await drained(id);
  const itv = await Interview.findById(id).populate('candidate', 'firstName lastName').populate('job', 'title recruiter');
  if (!itv || itv.status === 'evalue') return itv;
  const attempt = itv.quizAttempt ? await QuizAttempt.findById(itv.quizAttempt) : null;
  itv.evaluation = await evaluator.evaluate({ interview: itv, quizPercent: attempt?.percent ?? 0, useLlm: useLlm() });
  itv.status = 'evalue';
  await itv.save();
  const app = await Application.findById(itv.application);
  if (app && ['quiz_termine', 'invitee'].includes(app.status)) {
    app.moveTo('entretien_termine', `Entretien : ${itv.evaluation.overall}/100 (${itv.evaluation.recommendation})`);
    await app.save();
  }
  const recruiter = await User.findById(itv.job.recruiter);
  if (recruiter) {
    mail.sendLater(recruiter.email, 'interviewDone', {
      recruiterName: recruiter.firstName, candidateName: itv.candidateName, jobTitle: itv.job.title,
      overall: itv.evaluation.overall, recommendation: itv.evaluation.recommendation, reviewUrl: `${env.frontendUrl}/recruteur/entretiens/${itv._id}`,
    });
  }
  logger.info(`Entretien ${id} évalué : ${itv.evaluation.overall}/100 (${itv.evaluation.recommendation})`);
  return itv;
}

async function finish(id, user) {
  const itv = await Interview.findById(id);
  if (!itv) throw notFound();
  if (user && user.role === 'candidat' && String(itv.candidate) !== String(user._id)) throw notFound();
  if (itv.status === 'evalue' || itv.status === 'termine') return { status: itv.status };
  if (itv.status !== 'en_cours') throw new AppError('Cet entretien n\'est pas en cours.', 409, 'INVALID_STATUS');
  itv.status = 'termine';
  itv.endedAt = new Date();
  await itv.save();
  finalizeEvaluation(id).catch((err) => logger.error(`Évaluation de l'entretien ${id} en échec : ${err.message}`));
  return { status: 'termine', message: 'Entretien terminé : vos réponses sont en cours d\'analyse.' };
}

/** Recalcul (recruteur) : renote chaque réponse avec la grille actuelle puis refait l'évaluation. */
async function reevaluate(id) {
  const itv = await Interview.findById(id);
  if (!itv) throw notFound();
  if (!['termine', 'evalue'].includes(itv.status)) throw new AppError('Seul un entretien terminé peut être réévalué.', 409, 'INVALID_STATUS');
  for (const a of itv.answers) {
    const s = await scorer.scoreAnswer(itv.questions[a.questionIndex], a, { metierLabel: metierLabel(itv.metier), useLlm: useLlm() });
    Object.assign(a, { score: s.score, scores: s.scores, coveredPoints: s.coveredPoints, missedPoints: s.missedPoints, feedback: s.feedback });
  }
  itv.status = 'termine';
  await itv.save();
  return finalizeEvaluation(id);
}

async function decide(id, user, { value, comment, notify = true }) {
  const itv = await Interview.findById(id).populate('candidate').populate('job', 'title');
  if (!itv) throw notFound();
  if (itv.status !== 'evalue') throw new AppError('La décision se prend après l\'évaluation de l\'entretien.', 409, 'INVALID_STATUS');
  itv.decision = { value, comment, by: user._id, at: new Date() };
  await itv.save();
  const app = await Application.findById(itv.application);
  if (app && value !== 'en_attente') {
    app.moveTo(value === 'retenu' ? 'retenue' : 'non_retenue', `Décision du recruteur${comment ? ` : ${comment}` : ''}`);
    await app.save();
  }
  if (notify && value !== 'en_attente') {
    mail.sendLater(itv.candidate.email, 'decision', { firstName: itv.candidate.firstName, jobTitle: itv.job.title, retained: value === 'retenu', comment, overall: itv.evaluation.overall });
  }
  return itv;
}

/** Clôture automatique : entretien abandonné (en cours depuis trop longtemps) ou date limite dépassée. */
async function autoClose(itv) {
  if (itv.status === 'en_cours' && Date.now() > itv.startedAt.getTime() + itv.durationMinutes * 60000 + OVERTIME_MS) {
    await finish(itv._id).catch(() => {});
    itv.status = 'termine';
  } else if (itv.status === 'planifie' && itv.expiresAt < new Date()) {
    itv.status = 'expire';
    await Interview.updateOne({ _id: itv._id, status: 'planifie' }, { status: 'expire' });
  }
}

async function sweep() {
  const now = Date.now();
  const expired = await Interview.updateMany({ status: 'planifie', expiresAt: { $lt: new Date(now) } }, { status: 'expire' });
  const stale = await Interview.find({ status: 'en_cours', startedAt: { $lt: new Date(now - 15 * 60000) } }).select('_id');
  for (const s of stale) await finish(s._id).catch(() => {});
  // Entretiens « terminés » restés sans évaluation (serveur redémarré pendant l'analyse).
  const orphan = await Interview.find({ status: 'termine', endedAt: { $lt: new Date(now - 3 * 60000) } }).select('_id');
  for (const o of orphan) if (!queues.has(String(o._id))) finalizeEvaluation(o._id).catch(() => {});
  if (expired.modifiedCount || stale.length) logger.info(`Entretiens : ${expired.modifiedCount} expiré(s), ${stale.length} abandonné(s) clôturé(s)`);
}

function startSweeper() {
  const timer = setInterval(() => sweep().catch((err) => logger.warn(`Balayage des entretiens : ${err.message}`)), 60000);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}

// ---------- Statistiques ----------
async function stats({ metier, job } = {}) {
  const match = compact({ metier, job: job ? new (require('mongoose').Types.ObjectId)(job) : undefined });
  const evaluated = { ...match, status: 'evalue' };
  const [byStatus, byRecommendation, byDecision, byLanguage, byMetier, totals, perMonth, distribution, perQuestionType, provider] = await Promise.all([
    Interview.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Interview.aggregate([{ $match: evaluated }, { $group: { _id: '$evaluation.recommendation', count: { $sum: 1 } } }]),
    Interview.aggregate([{ $match: evaluated }, { $group: { _id: '$decision.value', count: { $sum: 1 } } }]),
    Interview.aggregate([{ $match: match }, { $unwind: '$answers' }, { $group: { _id: '$answers.detectedLanguage', count: { $sum: 1 } } }]),
    Interview.aggregate([{ $match: evaluated }, { $group: { _id: '$metier', count: { $sum: 1 }, avg: { $avg: '$evaluation.overall' } } }]),
    Interview.aggregate([{ $match: evaluated }, {
      $group: {
        _id: null, count: { $sum: 1 }, overall: { $avg: '$evaluation.overall' }, technical: { $avg: '$evaluation.technical' }, communication: { $avg: '$evaluation.communication' },
        motivation: { $avg: '$evaluation.motivation' }, quiz: { $avg: '$evaluation.quiz' }, duration: { $avg: { $subtract: ['$endedAt', '$startedAt'] } },
      },
    }]),
    Interview.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$scheduledAt', timezone: 'Africa/Tunis' } }, planned: { $sum: 1 }, evaluated: { $sum: { $cond: [{ $eq: ['$status', 'evalue'] }, 1, 0] } }, avg: { $avg: '$evaluation.overall' } } }, { $sort: { _id: 1 } }, { $limit: 12 }]),
    Interview.aggregate([{ $match: evaluated }, { $bucket: { groupBy: '$evaluation.overall', boundaries: [0, 20, 40, 60, 80, 101], default: 'autre', output: { count: { $sum: 1 } } } }]),
    Interview.aggregate([{ $match: evaluated }, { $unwind: { path: '$answers' } }, { $project: { score: '$answers.score', type: { $arrayElemAt: ['$questions.type', '$answers.questionIndex'] } } }, { $group: { _id: '$type', avg: { $avg: '$score' }, count: { $sum: 1 } } }]),
    Interview.aggregate([{ $match: match }, { $group: { _id: '$meet.provider', count: { $sum: 1 } } }]),
  ]);
  const t = totals[0] || {};
  const labels = ['0-19', '20-39', '40-59', '60-79', '80-100'];
  const total = byStatus.reduce((a, s) => a + s.count, 0);
  const evaluatedCount = byStatus.find((s) => s._id === 'evalue')?.count || 0;
  return {
    totals: {
      interviews: total,
      evaluated: evaluatedCount,
      completionRate: total ? Math.round((100 * evaluatedCount) / total) : 0,
      averageOverall: Math.round(t.overall || 0),
      averageTechnical: Math.round(t.technical || 0),
      averageCommunication: Math.round(t.communication || 0),
      averageMotivation: Math.round(t.motivation || 0),
      averageQuiz: Math.round(t.quiz || 0),
      averageDurationSec: t.duration ? Math.round(t.duration / 1000) : 0,
      retained: byDecision.find((d) => d._id === 'retenu')?.count || 0,
    },
    byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
    byRecommendation: byRecommendation.map((r) => ({ recommendation: r._id, count: r.count })),
    byDecision: byDecision.map((d) => ({ decision: d._id || 'en_attente', count: d.count })),
    byLanguage: byLanguage.map((l) => ({ language: l._id, answers: l.count })),
    byMetier: byMetier.map((m) => ({ metier: m._id, label: metierLabel(m._id), count: m.count, averageOverall: Math.round(m.avg) })),
    byProvider: provider.map((p) => ({ provider: p._id, count: p.count })),
    perQuestionType: perQuestionType.map((p) => ({ type: p._id, averageScore: Math.round(p.avg), answers: p.count })),
    perMonth: perMonth.map((m) => ({ month: m._id, planned: m.planned, evaluated: m.evaluated, averageOverall: m.avg === null ? null : Math.round(m.avg) })),
    scoreDistribution: labels.map((label, i) => ({ range: label, count: distribution.find((d) => d._id === [0, 20, 40, 60, 80][i])?.count || 0 })),
  };
}

module.exports = { list, get, create, update, remove, start, answer, finish, reevaluate, decide, stats, startSweeper, sweep, drained, detectLanguage };
