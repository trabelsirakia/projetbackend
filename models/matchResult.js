const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schema for storing the result of a candidate's match against a job posting
const matchResultSchema = new Schema({
  cvId: { type: String, required: true },
  jobId: { type: String, required: true, index: true },
  candidateId: { type: String, required: true },
  scores: {
    technique: { type: Number, min: 0, max: 100, default: 0 },
    experience: { type: Number, min: 0, max: 100, default: 0 },
    formation: { type: Number, min: 0, max: 100, default: 0 },
    langues: { type: Number, min: 0, max: 100, default: 0 },
    certifications: { type: Number, min: 0, max: 100, default: 0 }
  },
  weightsUsed: {
    technique: Number,
    experience: Number,
    formation: Number,
    langues: Number,
    certifications: Number
  },
  totalScore: { type: Number, min: 0, max: 100, default: 0 },
  explanation: {
    foundSkills: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    notes: String
  },
  eliminationReasons: { type: [String], default: [] },
  eliminated: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['PENDING', 'SCORED', 'SHORTLISTED', 'REJECTED'],
    default: 'PENDING'
  },
  duplicateOf: { type: Schema.Types.ObjectId, ref: 'MatchResult', default: null },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });





























// Composite unique index to avoid duplicate entries per CV/Job pair
matchResultSchema.index({ cvId: 1, jobId: 1 }, { unique: true });
matchResultSchema.index({ candidateId: 1, jobId: 1 });




// Calcul automatique du totalScore si scores et weightsUsed sont définis
matchResultSchema.pre('save', function (next) {
  if (this.scores && this.weightsUsed) {
    const s = this.scores;
    const w = this.weightsUsed;
    const computed =
      (s.technique || 0) * (w.technique || 0) +
      (s.experience || 0) * (w.experience || 0) +
      (s.formation || 0) * (w.formation || 0) +
      (s.langues || 0) * (w.langues || 0) +
      (s.certifications || 0) * (w.certifications || 0);

    if (computed > 0) {
      this.totalScore = Math.round(computed * 100) / 100;
    }
  }
  next();
});

module.exports = mongoose.model('MatchResult', matchResultSchema);

