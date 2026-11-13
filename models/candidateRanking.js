const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schema for ranking a candidate for a specific job based on a MatchResult
const candidateRankingSchema = new Schema({
  matchResultId: {
    type: Schema.Types.ObjectId,
    ref: 'MatchResult',
    required: true,
    unique: true
  },
  jobId: { type: String, required: true, index: true },
  candidateId: { type: String, required: true },
  rank: { type: Number, required: true, min: 1 },
  score: { type: Number, required: true },
  isTop5: { type: Boolean, default: false },
  invitationStatus: {
    type: String,
    enum: ['NOT_INVITED', 'INVITED', 'ACCEPTED', 'EXPIRED', 'DECLINED'],
    default: 'NOT_INVITED'
  },
  invitedAt: { type: Date, default: null }
}, { timestamps: true });

// Index to quickly fetch top‑ranked candidates per job
candidateRankingSchema.index({ jobId: 1, rank: 1 });

module.exports = mongoose.model('CandidateRanking', candidateRankingSchema);

