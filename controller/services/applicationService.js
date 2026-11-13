/**
 * CANDIDATURE : le point de départ de tout le parcours (bouton « Postuler »).
 *
 *  apply()   CV PDF → texte → job matching IA (score expliqué)
 *            ├─ score ≥ seuil de l'offre → invite() : quiz attribué + entretien planifié + lien Meet + e-mail d'acceptation
 *            └─ score < seuil            → refus + e-mail expliquant pourquoi (compétences manquantes, expérience…)
 *  Le recruteur peut forcer l'invitation (invite) ou refuser (reject) à tout moment avant l'entretien.
 */
const Application = require('../../models/Application');
const Job = require('../../models/Job');
const Quiz = require('../../models/Quiz');
const Interview = require('../../models/Interview');
const AppError = require('../../config/utils/AppError');
const env = require('../../config/env');
const logger = require('../../config/utils/logger');
const { paginate, compact, range } = require('../../config/utils/listQuery');
const { extractPdf } = require('../ai/cvText');
const matching = require('../ai/matching');
const quizGenerator = require('../ai/quizGenerator');
const { metierLabel } = require('../ai/data/metiers');
const meet = require('./meetService');
const mail = require('./emailService');

const INTERVIEW_VALIDITY_DAYS = 7;

/** Créneau proposé : prochain jour ouvré à 10 h (heure de Tunis, UTC+1). */
function proposedSlot(from = new Date()) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + 1);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(9, 0, 0, 0);
  return d;
}

/** Quiz de l'offre ; sinon quiz actif du métier ; sinon quiz créé à partir de la banque du métier. */
async function quizFor(job) {
  const existing = await Quiz.findOne({ job: job._id, status: 'actif' }) || await Quiz.findOne({ metier: job.metier, job: null, status: 'actif' });
  if (existing) return existing;
  const questions = quizGenerator.fromBank(job.metier, { requiredSkills: job.requiredSkills, count: 10 });
  return Quiz.create({
    title: `Quiz — ${job.title}`,
    description: `Quiz de compétences généré à partir de la banque du métier « ${metierLabel(job.metier)} », centré sur les compétences exigées par l'offre.`,
    metier: job.metier,
    job: job._id,
    durationMinutes: 8,
    passingScore: 60,
    questionsPerAttempt: questions.length,
    questions,
    source: 'banque',
    createdBy: job.recruiter,
  });
}

async function invite(application, { by = 'ia', note } = {}) {
  const job = application.job._id ? application.job : await Job.findById(application.job);
  const candidate = application.candidate.email ? application.candidate : await require('../../models/User').findById(application.candidate);
  const quiz = await quizFor(job);
  const scheduledAt = proposedSlot();
  const expiresAt = new Date(Date.now() + INTERVIEW_VALIDITY_DAYS * 24 * 3600 * 1000);
  const title = `Entretien — ${job.title}`;

  let interview = await Interview.findOne({ application: application._id });
  if (!interview) {
    const meeting = await meet.createMeeting({
      title: `${title} (${candidate.firstName} ${candidate.lastName})`,
      description: `Entretien vidéo TalentWave Live. Salle de l'avatar IA : ${env.frontendUrl}/entretien/${application._id}`,
      start: scheduledAt,
      durationMinutes: 5,
      attendees: [candidate.email],
    });
    interview = await Interview.create({
      application: application._id,
      candidate: candidate._id,
      candidateName: `${candidate.firstName} ${candidate.lastName}`,
      job: job._id,
      metier: job.metier,
      title,
      scheduledAt,
      expiresAt,
      language: candidate.preferredLanguage || 'fr',
      meet: meeting,
    });
  }

  application.quiz = quiz._id;
  application.interview = interview._id;
  application.moveTo('invitee', note || (by === 'ia' ? `Score ${application.matching.score} ≥ seuil ${job.matchThreshold} : invitation automatique` : 'Invitation par le recruteur'));
  await application.save();

  mail.sendLater(candidate.email, 'invitation', {
    firstName: candidate.firstName,
    jobTitle: job.title,
    score: application.matching?.score ?? 0,
    explanation: application.matching?.explanation || [],
    quizUrl: `${env.frontendUrl}/quiz/${application._id}`,
    roomUrl: `${env.frontendUrl}/entretien/${interview._id}`,
    meetLink: interview.meet.link,
    meetProvider: interview.meet.provider,
    scheduledAt: interview.scheduledAt,
    expiresAt: interview.expiresAt,
    quizMinutes: quiz.durationMinutes,
  });
  return { quiz, interview };
}

async function apply({ user, jobId, file, coverLetter }) {
  const job = await Job.findById(jobId);
  if (!job || job.status !== 'publiee') throw new AppError('Cette offre n\'est pas ouverte aux candidatures.', 404, 'JOB_NOT_FOUND');
  if (await Application.exists({ candidate: user._id, job: job._id })) {
    throw new AppError('Vous avez déjà postulé à cette offre.', 409, 'ALREADY_APPLIED');
  }
  if (!file) throw new AppError('Ajoutez votre CV au format PDF.', 422, 'CV_REQUIRED');
  const { text } = await extractPdf(file.buffer);

  const application = new Application({
    candidate: user._id,
    job: job._id,
    coverLetter,
    cvFileName: (file.originalname || 'cv.pdf').slice(0, 120),
    cvFile: file.buffer,
    cvText: text,
  });
  application.moveTo('soumise', 'Candidature déposée');
  const started = Date.now();
  application.matching = await matching.match({ cvText: `${text}\n${coverLetter || ''}`, job });
  logger.info(`Matching ${user.email} ↔ « ${job.title} » : ${application.matching.score}/100 en ${Date.now() - started} ms`);
  try {
    await application.save();
  } catch (err) {
    if (err.code === 11000) throw new AppError('Vous avez déjà postulé à cette offre.', 409, 'ALREADY_APPLIED');
    throw err;
  }

  if (application.matching.score >= job.matchThreshold) {
    application.job = job;
    application.candidate = user;
    await invite(application);
  } else {
    application.moveTo('refusee', `Score ${application.matching.score} < seuil ${job.matchThreshold}`);
    await application.save();
    mail.sendLater(user.email, 'rejection', {
      firstName: user.firstName,
      jobTitle: job.title,
      score: application.matching.score,
      explanation: application.matching.explanation,
      offersUrl: `${env.frontendUrl}/offres`,
    });
  }
  return Application.findById(application._id).populate('job', 'title metier location contractType matchThreshold').populate('interview', 'status scheduledAt expiresAt meet language');
}

const SORTS = ['createdAt', 'updatedAt', 'status', 'matching.score'];

async function list(query, user) {
  const base = user.role === 'candidat' ? { candidate: user._id } : {};
  if (user.role === 'recruteur' && query.mine === 'true') {
    base.job = { $in: await Job.find({ recruiter: user._id }).distinct('_id') };
  }
  return paginate(Application, query, {
    searchFields: ['cvFileName', 'coverLetter'],
    sortFields: SORTS,
    baseFilter: base,
    filters: (q) => compact({ status: q.status, job: q.job, 'matching.score': range(q.minScore, q.maxScore) }),
    populate: [
      { path: 'job', select: 'title metier location matchThreshold' },
      { path: 'candidate', select: 'firstName lastName email' },
      { path: 'interview', select: 'status scheduledAt expiresAt meet evaluation.overall evaluation.recommendation decision.value language' },
      { path: 'quizAttempt', select: 'percent passed status' },
    ],
  });
}

async function get(id, user) {
  const app = await Application.findById(id)
    .populate('job')
    .populate('candidate', 'firstName lastName email phone')
    .populate('quiz', 'title durationMinutes passingScore questionsPerAttempt metier language')
    .populate('quizAttempt', '-answers')
    .populate('interview', '-questions.keyPoints');
  if (!app) throw new AppError('Candidature introuvable.', 404, 'APPLICATION_NOT_FOUND');
  if (user.role === 'candidat' && String(app.candidate._id) !== String(user._id)) throw new AppError('Candidature introuvable.', 404, 'APPLICATION_NOT_FOUND');
  return app;
}

async function cv(id, user) {
  const app = await Application.findById(id).select('+cvFile candidate cvFileName');
  if (!app || (user.role === 'candidat' && String(app.candidate) !== String(user._id))) throw new AppError('Candidature introuvable.', 404, 'APPLICATION_NOT_FOUND');
  return app;
}

async function forceInvite(id) {
  const app = await Application.findById(id).populate('job').populate('candidate');
  if (!app) throw new AppError('Candidature introuvable.', 404, 'APPLICATION_NOT_FOUND');
  if (!['soumise', 'refusee'].includes(app.status)) throw new AppError(`Invitation impossible depuis le statut « ${app.status} ».`, 409, 'INVALID_STATUS');
  await invite(app, { by: 'recruteur' });
  return get(id, { role: 'recruteur' });
}

async function reject(id, note) {
  const app = await Application.findById(id).populate('job').populate('candidate');
  if (!app) throw new AppError('Candidature introuvable.', 404, 'APPLICATION_NOT_FOUND');
  if (['retenue', 'non_retenue', 'refusee', 'retiree'].includes(app.status)) throw new AppError('Cette candidature est déjà clôturée.', 409, 'INVALID_STATUS');
  app.moveTo('refusee', note || 'Refus par le recruteur');
  await app.save();
  if (app.interview) await Interview.updateOne({ _id: app.interview, status: 'planifie' }, { status: 'annule' });
  mail.sendLater(app.candidate.email, 'rejection', {
    firstName: app.candidate.firstName, jobTitle: app.job.title, score: app.matching?.score ?? 0, explanation: [note || 'Le recruteur a choisi d\'autres profils pour ce poste.'], offersUrl: `${env.frontendUrl}/offres`,
  });
  return app;
}

async function withdraw(id, user) {
  const app = await Application.findOne({ _id: id, candidate: user._id });
  if (!app) throw new AppError('Candidature introuvable.', 404, 'APPLICATION_NOT_FOUND');
  if (['retenue', 'non_retenue', 'retiree'].includes(app.status)) throw new AppError('Cette candidature est déjà clôturée.', 409, 'INVALID_STATUS');
  app.moveTo('retiree', 'Retirée par le candidat');
  await app.save();
  if (app.interview) {
    const itv = await Interview.findById(app.interview);
    if (itv && itv.status === 'planifie') {
      itv.status = 'annule';
      await itv.save();
      await meet.cancelMeeting(itv.meet);
    }
  }
  return app;
}

module.exports = { apply, invite, list, get, cv, forceInvite, reject, withdraw, proposedSlot, quizFor };
