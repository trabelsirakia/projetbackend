/**
 * QUIZ : CRUD (recruteur), recherche / filtres / tri / pagination, statistiques, génération IA,
 * et passage par le candidat (démarrage chronométré, correction côté serveur, résultats par compétence).
 */
const mongoose = require('mongoose');
const Quiz = require('../../models/Quiz');
const QuizAttempt = require('../../models/QuizAttempt');
const Application = require('../../models/Application');
const Job = require('../../models/Job');
const AppError = require('../../config/utils/AppError');
const { paginate, compact, range } = require('../../config/utils/listQuery');
const generator = require('../ai/quizGenerator');
const { METIERS, metierLabel } = require('../ai/data/metiers');

const GRACE_MS = 15000;
const SORTS = ['createdAt', 'updatedAt', 'title', 'durationMinutes', 'passingScore', 'difficulty', 'metier', 'status'];

const notFound = () => new AppError('Quiz introuvable.', 404, 'QUIZ_NOT_FOUND');

// ---------- CRUD ----------
async function list(query) {
  const res = await paginate(Quiz, query, {
    searchFields: ['title', 'description', 'questions.skill'],
    sortFields: SORTS,
    filters: (q) => compact({
      metier: q.metier,
      status: q.status,
      difficulty: q.difficulty,
      language: q.language,
      source: q.source,
      job: q.job,
      durationMinutes: range(q.minDuration, q.maxDuration),
      passingScore: range(q.minPassing, q.maxPassing),
    }),
    populate: [{ path: 'job', select: 'title' }],
  });
  // Nombre de passages et moyenne par quiz de la page (une seule agrégation).
  const ids = res.items.map((x) => x._id);
  const agg = await QuizAttempt.aggregate([
    { $match: { quiz: { $in: ids }, status: { $ne: 'en_cours' } } },
    { $group: { _id: '$quiz', attempts: { $sum: 1 }, avg: { $avg: '$percent' }, passRate: { $avg: { $cond: ['$passed', 1, 0] } } } },
  ]);
  const byId = new Map(agg.map((a) => [String(a._id), a]));
  res.items = res.items.map((x) => {
    const a = byId.get(String(x._id));
    const json = x.toJSON();
    delete json.questions; // la liste reste légère
    return { ...json, attempts: a?.attempts || 0, averageScore: a ? Math.round(a.avg) : null, passRate: a ? Math.round(a.passRate * 100) : null };
  });
  return res;
}

async function get(id) {
  const quiz = await Quiz.findById(id).populate('job', 'title').populate('createdBy', 'firstName lastName');
  if (!quiz) throw notFound();
  return quiz;
}

async function create(data, user) {
  if (data.job && !(await Job.exists({ _id: data.job }))) throw new AppError('Offre introuvable.', 404, 'JOB_NOT_FOUND');
  return Quiz.create({ ...data, source: data.source || 'manuel', createdBy: user._id });
}

async function update(id, data) {
  const quiz = await Quiz.findById(id);
  if (!quiz) throw notFound();
  if (data.questions && await QuizAttempt.exists({ quiz: id, status: 'en_cours' })) {
    throw new AppError('Des candidats passent ce quiz en ce moment : modifiez les questions plus tard.', 409, 'QUIZ_IN_USE');
  }
  Object.assign(quiz, data);
  if (quiz.questionsPerAttempt > quiz.questions.length && quiz.questions.length) quiz.questionsPerAttempt = quiz.questions.length;
  return quiz.save();
}

async function remove(id) {
  const quiz = await Quiz.findById(id);
  if (!quiz) throw notFound();
  if (await QuizAttempt.exists({ quiz: id })) {
    throw new AppError('Ce quiz a déjà été passé : archivez-le (statut « archive ») pour garder l\'historique des résultats.', 409, 'QUIZ_HAS_ATTEMPTS');
  }
  await Application.updateMany({ quiz: id }, { quiz: null });
  await quiz.deleteOne();
}

async function duplicate(id, user) {
  const quiz = await Quiz.findById(id).lean();
  if (!quiz) throw notFound();
  const { _id, createdAt, updatedAt, ...rest } = quiz;
  return Quiz.create({ ...rest, title: `${quiz.title} (copie)`.slice(0, 140), status: 'inactif', createdBy: user._id, questions: rest.questions.map(({ _id: qid, ...qq }) => qq) });
}

/** Génération : banque du métier (instantané) ou LLM (questions nouvelles), quiz créé inactif pour relecture. */
async function generate({ metier, job: jobId, count = 8, difficulty = 'moyen', language = 'fr', mode = 'ia' }, user) {
  const job = jobId ? await Job.findById(jobId) : null;
  if (jobId && !job) throw new AppError('Offre introuvable.', 404, 'JOB_NOT_FOUND');
  const m = job?.metier || metier;
  const skills = job?.requiredSkills?.length ? job.requiredSkills : METIERS[m].skills.map((s) => s.name).slice(0, 6);
  let questions;
  let source;
  let info = {};
  if (mode === 'banque') {
    questions = generator.fromBank(m, { requiredSkills: skills, count });
    source = 'banque';
  } else {
    const out = await generator.withLlm({ metier: m, skills, count, difficulty, language });
    questions = out.questions;
    source = 'ia';
    info = { model: out.model, durationMs: out.durationMs };
  }
  if (!questions.length) throw new AppError('Aucune question exploitable n\'a été produite. Réessayez.', 502, 'GENERATION_EMPTY');
  const quiz = await Quiz.create({
    title: `${source === 'ia' ? 'Quiz IA' : 'Quiz'} — ${job?.title || metierLabel(m)}`,
    description: `Généré (${source}) pour les compétences : ${skills.join(', ')}.`,
    metier: m,
    job: job?._id || null,
    language,
    difficulty,
    durationMinutes: Math.max(3, Math.ceil(questions.length * 0.8)),
    questionsPerAttempt: questions.length,
    questions,
    source,
    status: 'inactif',
    createdBy: user._id,
  });
  return { quiz, ...info };
}

async function attemptsOf(id, query) {
  if (!(await Quiz.exists({ _id: id }))) throw notFound();
  return paginate(QuizAttempt, query, {
    sortFields: ['createdAt', 'percent', 'submittedAt'],
    baseFilter: { quiz: id },
    filters: (q) => compact({ status: q.status, passed: q.passed === undefined ? undefined : q.passed === 'true' }),
    select: '-answers',
    populate: [{ path: 'candidate', select: 'firstName lastName email' }],
  });
}

// ---------- Statistiques ----------
async function stats({ metier } = {}) {
  const quizMatch = metier ? { metier } : {};
  const quizIds = await Quiz.find(quizMatch).distinct('_id');
  const done = { quiz: { $in: quizIds }, status: { $ne: 'en_cours' } };
  const [byStatus, byMetier, byDifficulty, totals, distribution, perSkill, perQuiz, perMonth] = await Promise.all([
    Quiz.aggregate([{ $match: quizMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Quiz.aggregate([{ $match: quizMatch }, { $group: { _id: '$metier', count: { $sum: 1 }, questions: { $sum: { $size: '$questions' } } } }]),
    Quiz.aggregate([{ $match: quizMatch }, { $group: { _id: '$difficulty', count: { $sum: 1 } } }]),
    QuizAttempt.aggregate([{ $match: done }, { $group: { _id: null, attempts: { $sum: 1 }, avg: { $avg: '$percent' }, passRate: { $avg: { $cond: ['$passed', 1, 0] } }, best: { $max: '$percent' } } }]),
    QuizAttempt.aggregate([{ $match: done }, { $bucket: { groupBy: '$percent', boundaries: [0, 20, 40, 60, 80, 101], default: 'autre', output: { count: { $sum: 1 } } } }]),
    QuizAttempt.aggregate([{ $match: done }, { $unwind: '$perSkill' }, { $group: { _id: '$perSkill.skill', correct: { $sum: '$perSkill.correct' }, total: { $sum: '$perSkill.total' } } }, { $sort: { total: -1 } }, { $limit: 12 }]),
    QuizAttempt.aggregate([{ $match: done }, { $group: { _id: '$quiz', attempts: { $sum: 1 }, avg: { $avg: '$percent' }, passRate: { $avg: { $cond: ['$passed', 1, 0] } } } }, { $sort: { attempts: -1 } }, { $limit: 8 },
      { $lookup: { from: 'quizzes', localField: '_id', foreignField: '_id', as: 'quiz' } }, { $unwind: '$quiz' }]),
    QuizAttempt.aggregate([{ $match: done }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'Africa/Tunis' } }, attempts: { $sum: 1 }, avg: { $avg: '$percent' } } }, { $sort: { _id: 1 } }, { $limit: 12 }]),
  ]);
  const labels = ['0-19', '20-39', '40-59', '60-79', '80-100'];
  const t = totals[0] || { attempts: 0, avg: 0, passRate: 0, best: 0 };
  return {
    totals: {
      quizzes: quizIds.length,
      active: byStatus.find((s) => s._id === 'actif')?.count || 0,
      questions: byMetier.reduce((a, m) => a + m.questions, 0),
      attempts: t.attempts,
      averageScore: Math.round(t.avg || 0),
      passRate: Math.round((t.passRate || 0) * 100),
      bestScore: Math.round(t.best || 0),
    },
    byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
    byMetier: byMetier.map((m) => ({ metier: m._id, label: metierLabel(m._id), count: m.count, questions: m.questions })),
    byDifficulty: byDifficulty.map((d) => ({ difficulty: d._id, count: d.count })),
    scoreDistribution: labels.map((label, i) => ({ range: label, count: distribution.find((d) => d._id === [0, 20, 40, 60, 80][i])?.count || 0 })),
    perSkill: perSkill.map((s) => ({ skill: s._id, successRate: s.total ? Math.round((100 * s.correct) / s.total) : 0, answered: s.total })),
    perQuiz: perQuiz.map((p) => ({ id: String(p._id), title: p.quiz.title, attempts: p.attempts, averageScore: Math.round(p.avg), passRate: Math.round(p.passRate * 100) })),
    perMonth: perMonth.map((m) => ({ month: m._id, attempts: m.attempts, averageScore: Math.round(m.avg) })),
  };
}

// ---------- Passage par le candidat ----------
const publicQuestion = (qq) => ({ id: String(qq._id), text: qq.text, options: qq.options, skill: qq.skill, points: qq.points });

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function ownApplication(applicationId, user) {
  const app = await Application.findById(applicationId).populate('quiz');
  if (!app || String(app.candidate) !== String(user._id)) throw new AppError('Candidature introuvable.', 404, 'APPLICATION_NOT_FOUND');
  return app;
}

/** Ce que voit le candidat avant de commencer (aucune question). */
async function overview(applicationId, user) {
  const app = await ownApplication(applicationId, user);
  if (!app.quiz) throw new AppError('Aucun quiz n\'est associé à cette candidature.', 404, 'QUIZ_NOT_FOUND');
  const attempts = await QuizAttempt.find({ application: app._id }).sort('-createdAt').select('-answers');
  const q = app.quiz;
  return {
    applicationStatus: app.status,
    quiz: { id: String(q._id), title: q.title, description: q.description, durationMinutes: q.durationMinutes, passingScore: q.passingScore, questionCount: Math.min(q.questionsPerAttempt, q.questions.length), maxAttempts: q.maxAttempts, skills: q.skills, language: q.language },
    attempts,
    canStart: ['invitee', 'quiz_termine'].includes(app.status) && attempts.filter((a) => a.status !== 'en_cours').length < q.maxAttempts && app.status !== 'entretien_termine',
  };
}

async function start(applicationId, user) {
  const app = await ownApplication(applicationId, user);
  if (!app.quiz) throw new AppError('Aucun quiz n\'est associé à cette candidature.', 404, 'QUIZ_NOT_FOUND');
  if (!['invitee', 'quiz_termine'].includes(app.status)) throw new AppError('Le quiz n\'est pas (ou plus) disponible pour cette candidature.', 409, 'INVALID_STATUS');
  // Un quiz désactivé APRÈS l'invitation reste passable : le candidat garde celui qui lui a été attribué.
  const quiz = app.quiz;
  const running = await QuizAttempt.findOne({ application: app._id, status: 'en_cours' });
  if (running && running.deadlineAt.getTime() + GRACE_MS > Date.now()) {
    const byId = new Map(quiz.questions.map((qq) => [String(qq._id), qq]));
    return { attempt: running, questions: running.questionIds.map((id) => publicQuestion(byId.get(String(id)))).filter(Boolean), resumed: true };
  }
  if (running) await finalize(running, quiz, running.answers, 'expiree');
  const finished = await QuizAttempt.countDocuments({ application: app._id, status: { $ne: 'en_cours' } });
  if (finished >= quiz.maxAttempts) throw new AppError('Vous avez utilisé toutes vos tentatives pour ce quiz.', 409, 'NO_ATTEMPTS_LEFT');
  if (!quiz.questions.length) throw new AppError('Ce quiz ne contient aucune question.', 409, 'QUIZ_EMPTY');

  const pool = quiz.shuffleQuestions ? shuffle(quiz.questions) : quiz.questions;
  const picked = pool.slice(0, Math.min(quiz.questionsPerAttempt, quiz.questions.length));
  const attempt = await QuizAttempt.create({
    quiz: quiz._id,
    application: app._id,
    candidate: user._id,
    questionIds: picked.map((qq) => qq._id),
    deadlineAt: new Date(Date.now() + quiz.durationMinutes * 60000),
  });
  return { attempt, questions: picked.map(publicQuestion), resumed: false };
}

async function finalize(attempt, quiz, answers, status) {
  const byId = new Map(quiz.questions.map((qq) => [String(qq._id), qq]));
  const given = new Map((answers || []).map((a) => [String(a.questionId), a]));
  let score = 0;
  let maxScore = 0;
  const skills = new Map();
  attempt.answers = attempt.questionIds.map((qid) => {
    const qq = byId.get(String(qid));
    if (!qq) return null;
    const a = given.get(String(qid));
    const selected = Number.isInteger(a?.selectedIndex) ? a.selectedIndex : null;
    const correct = selected === qq.correctIndex;
    maxScore += qq.points;
    if (correct) score += qq.points;
    const s = skills.get(qq.skill) || { correct: 0, total: 0 };
    s.total += 1;
    if (correct) s.correct += 1;
    skills.set(qq.skill, s);
    return { questionId: qid, selectedIndex: selected, correct, points: correct ? qq.points : 0, skill: qq.skill, timeMs: a?.timeMs ?? null };
  }).filter(Boolean);
  attempt.score = score;
  attempt.maxScore = maxScore;
  attempt.percent = maxScore ? Math.round((100 * score) / maxScore) : 0;
  attempt.passed = status === 'terminee' && attempt.percent >= quiz.passingScore;
  attempt.perSkill = [...skills.entries()].map(([skill, s]) => ({ skill, correct: s.correct, total: s.total, percent: Math.round((100 * s.correct) / s.total) }));
  attempt.status = status;
  attempt.submittedAt = new Date();
  await attempt.save();

  const app = await Application.findById(attempt.application);
  if (app && app.status === 'invitee') {
    app.quizAttempt = attempt._id;
    app.moveTo('quiz_termine', `Quiz : ${attempt.percent}/100${status === 'expiree' ? ' (temps dépassé)' : ''}`);
    await app.save();
  } else if (app && (!app.quizAttempt || attempt.percent > 0)) {
    app.quizAttempt = attempt._id;
    await app.save();
  }
  return attempt;
}

async function submit(attemptId, answers, user) {
  if (!mongoose.isValidObjectId(attemptId)) throw new AppError('Tentative introuvable.', 404, 'ATTEMPT_NOT_FOUND');
  const attempt = await QuizAttempt.findById(attemptId);
  if (!attempt || String(attempt.candidate) !== String(user._id)) throw new AppError('Tentative introuvable.', 404, 'ATTEMPT_NOT_FOUND');
  if (attempt.status !== 'en_cours') throw new AppError('Ce quiz a déjà été envoyé.', 409, 'ATTEMPT_CLOSED');
  const quiz = await Quiz.findById(attempt.quiz);
  const late = Date.now() > attempt.deadlineAt.getTime() + GRACE_MS;
  await finalize(attempt, quiz, answers, late ? 'expiree' : 'terminee');
  return result(attempt, quiz);
}

/** Correction détaillée (après envoi seulement). */
function result(attempt, quiz) {
  const byId = new Map(quiz.questions.map((qq) => [String(qq._id), qq]));
  return {
    attempt,
    passingScore: quiz.passingScore,
    correction: attempt.answers.map((a) => {
      const qq = byId.get(String(a.questionId));
      return { questionId: String(a.questionId), text: qq?.text, options: qq?.options, selectedIndex: a.selectedIndex, correctIndex: qq?.correctIndex, correct: a.correct, explanation: qq?.explanation, skill: a.skill };
    }),
  };
}

async function getAttempt(attemptId, user) {
  const attempt = await QuizAttempt.findById(attemptId);
  if (!attempt || (user.role === 'candidat' && String(attempt.candidate) !== String(user._id))) throw new AppError('Tentative introuvable.', 404, 'ATTEMPT_NOT_FOUND');
  if (attempt.status === 'en_cours') return { attempt };
  return result(attempt, await Quiz.findById(attempt.quiz));
}

module.exports = { list, get, create, update, remove, duplicate, generate, attemptsOf, stats, overview, start, submit, getAttempt };
