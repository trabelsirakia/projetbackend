const mongoose = require('mongoose');
const { METIER_KEYS } = require('../controller/ai/data/metiers');

/**
 * QUIZ (entité métier n°1) : test de compétences passé AVANT l'entretien vidéo.
 * Ses résultats par compétence orientent les questions de l'avatar (on creuse les points faibles).
 *
 * Attributs :
 *  - title, description, metier, job (offre ciblée, facultatif : un quiz peut servir à tout un métier)
 *  - language (fr | en), difficulty (facile | moyen | difficile)
 *  - durationMinutes : chrono global ; passingScore : % pour réussir ; questionsPerAttempt : tirage dans la banque
 *  - shuffleQuestions, maxAttempts
 *  - questions[] : text, options (2 à 6), correctIndex, explanation, skill, points, difficulty
 *  - status (actif | inactif | archive), source (banque | ia | manuel), createdBy
 */
const questionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, minlength: 5, maxlength: 600 },
  options: {
    type: [{ type: String, trim: true, maxlength: 300 }],
    validate: { validator: (v) => v.length >= 2 && v.length <= 6, message: 'Une question a entre 2 et 6 réponses.' },
  },
  correctIndex: { type: Number, required: true, min: 0 },
  explanation: { type: String, trim: true, maxlength: 800, default: '' },
  skill: { type: String, trim: true, required: true, maxlength: 60 },
  points: { type: Number, min: 1, max: 10, default: 1 },
  difficulty: { type: String, enum: ['facile', 'moyen', 'difficile'], default: 'moyen' },
});

questionSchema.path('correctIndex').validate(function check(v) { return v < this.options.length; }, 'correctIndex hors des réponses proposées.');

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 1500, default: '' },
    metier: { type: String, enum: METIER_KEYS, required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
    language: { type: String, enum: ['fr', 'en'], default: 'fr' },
    difficulty: { type: String, enum: ['facile', 'moyen', 'difficile'], default: 'moyen' },
    durationMinutes: { type: Number, min: 2, max: 60, default: 10 },
    passingScore: { type: Number, min: 0, max: 100, default: 60 },
    questionsPerAttempt: { type: Number, min: 1, max: 50, default: 10 },
    shuffleQuestions: { type: Boolean, default: true },
    maxAttempts: { type: Number, min: 1, max: 5, default: 1 },
    questions: { type: [questionSchema], default: [] },
    status: { type: String, enum: ['actif', 'inactif', 'archive'], default: 'actif' },
    source: { type: String, enum: ['banque', 'ia', 'manuel'], default: 'manuel' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      virtuals: true,
      transform(doc, ret) { ret.id = String(ret._id); delete ret._id; return ret; },
    },
  },
);

quizSchema.virtual('questionCount').get(function count() { return (this.questions || []).length; });
quizSchema.virtual('skills').get(function skills() { return [...new Set((this.questions || []).map((q) => q.skill))]; });

quizSchema.index({ metier: 1, status: 1 });
quizSchema.index({ job: 1 });
quizSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Quiz', quizSchema);
