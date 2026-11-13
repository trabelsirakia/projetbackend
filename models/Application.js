const mongoose = require('mongoose');

/**
 * Candidature : TOUT commence ici, au clic sur « Postuler ».
 *
 * Cycle de vie (status) :
 *   soumise ──(job matching IA)──► refusee            score < seuil de l'offre : e-mail de refus avec conseils
 *                                 └► invitee           score ≥ seuil : e-mail d'acceptation (quiz + salle d'entretien + Meet)
 *   invitee ──(quiz passé)──► quiz_termine ──(entretien avatar 5 min)──► entretien_termine
 *   entretien_termine ──(décision du recruteur, e-mail)──► retenue | non_retenue
 */
const STATUSES = ['soumise', 'refusee', 'invitee', 'quiz_termine', 'entretien_termine', 'retenue', 'non_retenue', 'retiree'];

const applicationSchema = new mongoose.Schema(
  {
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    coverLetter: { type: String, trim: true, maxlength: 3000, default: '' },
    cvFileName: { type: String, required: true },
    cvFile: { type: Buffer, select: false },
    cvText: { type: String, select: false },
    status: { type: String, enum: STATUSES, default: 'soumise' },
    matching: {
      score: Number,
      breakdown: { skills: Number, semantic: Number, experience: Number, languages: Number },
      matchedSkills: [{ skill: String, evidence: String, similarity: Number }],
      missingSkills: [String],
      experienceYears: Number,
      languagesFound: [String],
      explanation: [String],
      method: String,
      computedAt: Date,
    },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', default: null },
    quizAttempt: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizAttempt', default: null },
    interview: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', default: null },
    timeline: [{ _id: false, at: { type: Date, default: Date.now }, status: String, note: String }],
  },
  { timestamps: true, toJSON: { versionKey: false, transform(doc, ret) { ret.id = String(ret._id); delete ret._id; delete ret.cvFile; return ret; } } },
);

// Un candidat ne postule qu'une fois par offre.
applicationSchema.index({ candidate: 1, job: 1 }, { unique: true });
applicationSchema.index({ job: 1, status: 1 });

applicationSchema.methods.moveTo = function moveTo(status, note = '') {
  this.status = status;
  this.timeline.push({ status, note, at: new Date() });
};

module.exports = mongoose.model('Application', applicationSchema);
module.exports.STATUSES = STATUSES;
