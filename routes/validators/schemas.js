/** Schémas Joi de validation des entrées (messages en français). */
const Joi = require('joi');
const { METIER_KEYS } = require('../../controller/ai/data/metiers');

const messages = {
  'string.empty': '{#label} est obligatoire.',
  'any.required': '{#label} est obligatoire.',
  'string.email': 'Adresse e-mail invalide.',
  'string.min': '{#label} : {#limit} caractères minimum.',
  'string.max': '{#label} : {#limit} caractères maximum.',
  'any.only': '{#label} : valeur non autorisée.',
  'number.base': '{#label} doit être un nombre.',
  'number.min': '{#label} doit être ≥ {#limit}.',
  'number.max': '{#label} doit être ≤ {#limit}.',
  'string.pattern.base': '{#label} : format invalide.',
};
const J = Joi.defaults((s) => s.prefs({ messages }));

const id = J.string().hex().length(24);
const password = J.string().min(8).max(72).pattern(/[a-z]/).pattern(/[A-Z]/).pattern(/\d/)
  .messages({ 'string.pattern.base': 'Le mot de passe doit contenir une minuscule, une majuscule et un chiffre.' });
const listQuery = {
  page: J.number().integer().min(1).default(1),
  limit: J.number().integer().min(1).max(100).default(10),
  q: J.string().trim().max(80).allow(''),
  sort: J.string().trim().max(80).allow(''),
};

// ---------- Auth / utilisateurs ----------
const auth = {
  signup: J.object({
    firstName: J.string().trim().min(2).max(50).required().label('Le prénom'),
    lastName: J.string().trim().min(2).max(50).required().label('Le nom'),
    email: J.string().trim().email().max(254).required().label('L\'e-mail'),
    password: password.required().label('Le mot de passe'),
    phone: J.string().trim().max(30).allow('').label('Le téléphone'),
    preferredLanguage: J.string().valid('fr', 'en').default('fr'),
  }),
  login: J.object({ email: J.string().trim().email().required().label('L\'e-mail'), password: J.string().required().max(200).label('Le mot de passe') }),
  forgot: J.object({ email: J.string().trim().email().required().label('L\'e-mail') }),
  reset: J.object({ token: J.string().required().max(2000), password: password.required().label('Le mot de passe') }),
  refresh: J.object({ refreshToken: J.string().max(2000) }),
  changePassword: J.object({ currentPassword: J.string().required().max(200), newPassword: password.required().label('Le nouveau mot de passe') }),
  updateMe: J.object({
    firstName: J.string().trim().min(2).max(50), lastName: J.string().trim().min(2).max(50), phone: J.string().trim().max(30).allow(''), preferredLanguage: J.string().valid('fr', 'en'),
  }).min(1),
};

const users = {
  list: J.object({ ...listQuery, role: J.string().valid('candidat', 'recruteur', 'admin'), blocked: J.string().valid('true', 'false') }),
  create: J.object({
    firstName: J.string().trim().min(2).max(50).required(), lastName: J.string().trim().min(2).max(50).required(), email: J.string().trim().email().required(),
    password: password.required(), role: J.string().valid('candidat', 'recruteur', 'admin').required(),
  }),
  update: J.object({ role: J.string().valid('candidat', 'recruteur', 'admin'), isBlocked: J.boolean(), firstName: J.string().trim().min(2).max(50), lastName: J.string().trim().min(2).max(50) }).min(1),
};

// ---------- Offres ----------
const skills = J.array().items(J.string().trim().min(1).max(60)).max(25);
const jobBody = {
  title: J.string().trim().min(3).max(120).label('Le titre'),
  metier: J.string().valid(...METIER_KEYS).label('Le métier'),
  description: J.string().trim().min(30).max(6000).label('La description'),
  requiredSkills: skills,
  niceToHaveSkills: skills,
  minExperienceYears: J.number().min(0).max(30),
  languages: J.array().items(J.string().trim().lowercase().max(30)).max(6),
  location: J.string().trim().max(80),
  contractType: J.string().valid('CDI', 'CDD', 'Stage', 'Freelance', 'Alternance'),
  remote: J.string().valid('sur site', 'hybride', 'télétravail'),
  salaryRange: J.string().trim().max(60).allow(''),
  matchThreshold: J.number().integer().min(0).max(100),
  status: J.string().valid('brouillon', 'publiee', 'fermee'),
};
const jobs = {
  list: J.object({
    ...listQuery, metier: J.string().valid(...METIER_KEYS), contractType: jobBody.contractType, remote: jobBody.remote, status: jobBody.status,
    location: J.string().trim().max(60), maxExperience: J.number().min(0).max(30), mine: J.string().valid('true', 'false'),
  }),
  create: J.object({ ...jobBody, title: jobBody.title.required(), metier: jobBody.metier.required(), description: jobBody.description.required() }),
  update: J.object(jobBody).min(1),
};

// ---------- Candidatures ----------
const APP_STATUSES = ['soumise', 'refusee', 'invitee', 'quiz_termine', 'entretien_termine', 'retenue', 'non_retenue', 'retiree'];
const applications = {
  apply: J.object({ jobId: id.required().label('L\'offre'), coverLetter: J.string().trim().max(3000).allow('') }),
  list: J.object({ ...listQuery, status: J.string().valid(...APP_STATUSES), job: id, minScore: J.number().min(0).max(100), maxScore: J.number().min(0).max(100), mine: J.string().valid('true', 'false') }),
  reject: J.object({ note: J.string().trim().max(500).allow('') }),
};

// ---------- Quiz ----------
const question = J.object({
  _id: id,
  text: J.string().trim().min(5).max(600).required().label('L\'énoncé'),
  options: J.array().items(J.string().trim().min(1).max(300)).min(2).max(6).required().label('Les réponses'),
  correctIndex: J.number().integer().min(0).required().label('La bonne réponse'),
  explanation: J.string().trim().max(800).allow(''),
  skill: J.string().trim().min(1).max(60).required().label('La compétence'),
  points: J.number().integer().min(1).max(10).default(1),
  difficulty: J.string().valid('facile', 'moyen', 'difficile').default('moyen'),
}).custom((v, h) => (v.correctIndex < v.options.length ? v : h.message('La bonne réponse doit désigner une des réponses proposées.')));

const quizBody = {
  title: J.string().trim().min(3).max(140).label('Le titre'),
  description: J.string().trim().max(1500).allow(''),
  metier: J.string().valid(...METIER_KEYS).label('Le métier'),
  job: id.allow(null),
  language: J.string().valid('fr', 'en'),
  difficulty: J.string().valid('facile', 'moyen', 'difficile'),
  durationMinutes: J.number().integer().min(2).max(60).label('La durée'),
  passingScore: J.number().integer().min(0).max(100).label('Le score de réussite'),
  questionsPerAttempt: J.number().integer().min(1).max(50),
  shuffleQuestions: J.boolean(),
  maxAttempts: J.number().integer().min(1).max(5),
  questions: J.array().items(question).max(100),
  status: J.string().valid('actif', 'inactif', 'archive'),
};
const quizzes = {
  list: J.object({
    ...listQuery, metier: J.string().valid(...METIER_KEYS), status: quizBody.status, difficulty: quizBody.difficulty, language: quizBody.language,
    source: J.string().valid('banque', 'ia', 'manuel'), job: id, minDuration: J.number().min(0), maxDuration: J.number().min(0), minPassing: J.number().min(0).max(100), maxPassing: J.number().min(0).max(100),
  }),
  create: J.object({ ...quizBody, title: quizBody.title.required(), metier: quizBody.metier.required(), questions: quizBody.questions.min(1).required() }),
  update: J.object(quizBody).min(1),
  generate: J.object({
    metier: J.string().valid(...METIER_KEYS), job: id, count: J.number().integer().min(1).max(15).default(6), difficulty: quizBody.difficulty.default('moyen'),
    language: quizBody.language.default('fr'), mode: J.string().valid('ia', 'banque').default('ia'),
  }).or('metier', 'job'),
  stats: J.object({ metier: J.string().valid(...METIER_KEYS) }),
  attempts: J.object({ ...listQuery, status: J.string().valid('en_cours', 'terminee', 'expiree'), passed: J.string().valid('true', 'false') }),
  submit: J.object({
    answers: J.array().items(J.object({ questionId: id.required(), selectedIndex: J.number().integer().min(0).max(5).allow(null), timeMs: J.number().integer().min(0).max(3600000) })).max(60).required(),
  }),
};

// ---------- Entretiens ----------
const ITV_STATUSES = ['planifie', 'en_cours', 'termine', 'evalue', 'annule', 'expire'];
const interviews = {
  list: J.object({
    ...listQuery, status: J.string().valid(...ITV_STATUSES), metier: J.string().valid(...METIER_KEYS), job: id, language: J.string().valid('fr', 'en'),
    provider: J.string().valid('google', 'jitsi'), recommendation: J.string().valid('recommande', 'a_revoir', 'non_recommande'), decision: J.string().valid('en_attente', 'retenu', 'non_retenu'),
    minScore: J.number().min(0).max(100), maxScore: J.number().min(0).max(100), from: J.date().iso(), to: J.date().iso(), mine: J.string().valid('true', 'false'),
  }),
  create: J.object({
    application: id.required().label('La candidature'), scheduledAt: J.date().iso().greater('now'), expiresAt: J.date().iso().greater('now'), language: J.string().valid('fr', 'en'),
    durationMinutes: J.number().integer().min(1).max(30), recruiterNotes: J.string().trim().max(3000).allow(''),
  }),
  update: J.object({
    scheduledAt: J.date().iso(), expiresAt: J.date().iso(), language: J.string().valid('fr', 'en'), durationMinutes: J.number().integer().min(1).max(30),
    recruiterNotes: J.string().trim().max(3000).allow(''), status: J.string().valid('planifie', 'annule'),
    avatar: J.object({ name: J.string().trim().min(2).max(30), voice: J.string().valid('feminine', 'masculine') }),
  }).min(1),
  start: J.object({ language: J.string().valid('fr', 'en') }),
  answer: J.object({
    questionIndex: J.number().integer().min(0).max(20).required(), transcript: J.string().trim().max(5000).allow(''), liveTranscript: J.string().trim().max(5000).allow(''),
    durationSec: J.number().min(0).max(600),
  }),
  decision: J.object({ value: J.string().valid('retenu', 'non_retenu', 'en_attente').required().label('La décision'), comment: J.string().trim().max(1500).allow(''), notify: J.boolean().default(true) }),
  stats: J.object({ metier: J.string().valid(...METIER_KEYS), job: id }),
};

// ---------- Chatbot ----------
const chatbot = {
  message: J.object({
    message: J.string().trim().min(1).max(2000).required().label('Le message'),
    history: J.array().items(J.object({ role: J.string().valid('user', 'assistant').required(), content: J.string().max(4000).required() })).max(20).default([]),
  }),
  practice: J.object({ metier: J.string().valid(...METIER_KEYS).required() }),
  evaluate: J.object({ question: J.string().trim().min(5).max(600).required(), answer: J.string().trim().min(1).max(5000).required() }),
};

const params = { id: J.object({ id: id.required() }) };

module.exports = { auth, users, jobs, applications, quizzes, interviews, chatbot, params, id };
