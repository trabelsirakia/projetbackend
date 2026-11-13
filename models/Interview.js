const mongoose = require('mongoose');
const { METIER_KEYS } = require('../controller/ai/data/metiers');

/**
 * ENTRETIEN (entité métier n°2) : visioconférence de 5 minutes menée par un avatar IA.
 *
 * Attributs :
 *  - application, candidate, candidateName, job, quizAttempt, metier, title
 *  - scheduledAt (créneau proposé dans l'e-mail), expiresAt (date limite), durationMinutes (5)
 *  - language (fr | en) : langue des questions de l'avatar ; la réponse est transcrite dans sa langue réelle
 *  - meet { provider: google | jitsi, link, eventId } : visioconférence avec le recruteur
 *  - avatar { name, voice }
 *  - questions[] : order, type (presentation | technique | situation | motivation), skill, text,
 *                  keyPoints (attendus de la grille), timeLimitSec, source (banque | ia)
 *  - answers[] : questionIndex, transcript, inputMode (voix | texte), detectedLanguage, durationSec,
 *                wordsPerMinute, scores { relevance, coverage, communication, llm }, score, coveredPoints, feedback
 *  - evaluation : overall, technical, communication, motivation, quiz, weights, recommendation, summary,
 *                 strengths, improvements, method
 *  - decision { value: en_attente | retenu | non_retenu, comment, by, at } : le recruteur a le dernier mot
 *  - status : planifie | en_cours | termine | evalue | annule | expire ; startedAt, endedAt, recruiterNotes
 */
const STATUSES = ['planifie', 'en_cours', 'termine', 'evalue', 'annule', 'expire'];

const interviewSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    quizAttempt: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizAttempt', default: null },
    metier: { type: String, enum: METIER_KEYS, required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    candidateName: { type: String, trim: true, default: '' }, // copie pour la recherche et le tri
    scheduledAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    durationMinutes: { type: Number, min: 1, max: 30, default: 5 },
    language: { type: String, enum: ['fr', 'en'], default: 'fr' },
    meet: {
      provider: { type: String, enum: ['google', 'jitsi'], default: 'jitsi' },
      link: String,
      eventId: String,
    },
    avatar: { name: { type: String, default: 'Nora' }, voice: { type: String, default: 'feminine' } },
    questions: [{
      _id: false,
      order: Number,
      type: { type: String, enum: ['presentation', 'technique', 'situation', 'motivation'] },
      skill: String,
      text: String,
      keyPoints: [String],
      timeLimitSec: { type: Number, default: 50 },
      source: { type: String, enum: ['banque', 'ia'], default: 'banque' },
    }],
    answers: [{
      _id: false,
      questionIndex: Number,
      transcript: String,
      inputMode: { type: String, enum: ['voix', 'texte'] },
      detectedLanguage: String,
      durationSec: Number,
      wordsPerMinute: Number,
      scores: { relevance: Number, coverage: Number, communication: Number, llm: Number },
      score: Number,
      coveredPoints: [String],
      missedPoints: [String],
      feedback: String,
      answeredAt: { type: Date, default: Date.now },
    }],
    evaluation: {
      overall: Number,
      technical: Number,
      communication: Number,
      motivation: Number,
      quiz: Number,
      weights: { quiz: Number, technical: Number, communication: Number, motivation: Number },
      recommendation: { type: String, enum: ['recommande', 'a_revoir', 'non_recommande'] },
      summary: String,
      strengths: [String],
      improvements: [String],
      method: String,
      evaluatedAt: Date,
    },
    decision: {
      value: { type: String, enum: ['en_attente', 'retenu', 'non_retenu'], default: 'en_attente' },
      comment: { type: String, maxlength: 1500 },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
    },
    status: { type: String, enum: STATUSES, default: 'planifie' },
    startedAt: Date,
    endedAt: Date,
    recruiterNotes: { type: String, trim: true, maxlength: 3000, default: '' },
  },
  { timestamps: true, toJSON: { versionKey: false, transform(doc, ret) { ret.id = String(ret._id); delete ret._id; return ret; } } },
);

interviewSchema.index({ status: 1, scheduledAt: 1 });
interviewSchema.index({ candidate: 1 });
interviewSchema.index({ job: 1 });
interviewSchema.index({ application: 1 }, { unique: true });

module.exports = mongoose.model('Interview', interviewSchema);
module.exports.STATUSES = STATUSES;
