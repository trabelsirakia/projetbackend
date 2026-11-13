const mongoose = require('mongoose');

/**
 * Passage d'un quiz par un candidat (lié à sa candidature).
 * Les bonnes réponses ne sont JAMAIS envoyées pendant le passage : la correction se fait côté serveur,
 * et le chrono est vérifié côté serveur (deadlineAt + 15 s de tolérance réseau).
 */
const attemptSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    questionIds: [{ type: mongoose.Schema.Types.ObjectId }],
    answers: [{
      _id: false,
      questionId: mongoose.Schema.Types.ObjectId,
      selectedIndex: { type: Number, default: null },
      correct: Boolean,
      points: Number,
      skill: String,
      timeMs: Number,
    }],
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    perSkill: [{ _id: false, skill: String, correct: Number, total: Number, percent: Number }],
    status: { type: String, enum: ['en_cours', 'terminee', 'expiree'], default: 'en_cours' },
    startedAt: { type: Date, default: Date.now },
    deadlineAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { versionKey: false, transform(doc, ret) { ret.id = String(ret._id); delete ret._id; return ret; } } },
);

attemptSchema.index({ quiz: 1, status: 1 });
attemptSchema.index({ application: 1 });

module.exports = mongoose.model('QuizAttempt', attemptSchema);
