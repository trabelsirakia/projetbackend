const mongoose = require('mongoose');
const { METIER_KEYS } = require('../controller/ai/data/metiers');

/**
 * Offre d'emploi rattachée à un MÉTIER du catalogue (controller/ai/data/metiers.js) : le métier fixe
 * la banque de questions du quiz, les questions de l'entretien et les pondérations de la note finale.
 */
const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    metier: { type: String, enum: METIER_KEYS, required: true },
    description: { type: String, required: true, trim: true, minlength: 30, maxlength: 6000 },
    requiredSkills: { type: [String], default: [] },
    niceToHaveSkills: { type: [String], default: [] },
    minExperienceYears: { type: Number, min: 0, max: 30, default: 0 },
    languages: { type: [String], default: ['français'] },
    location: { type: String, trim: true, default: 'Tunis' },
    contractType: { type: String, enum: ['CDI', 'CDD', 'Stage', 'Freelance', 'Alternance'], default: 'CDI' },
    remote: { type: String, enum: ['sur site', 'hybride', 'télétravail'], default: 'hybride' },
    salaryRange: { type: String, trim: true, default: '' },
    // Score de correspondance minimal (0-100) pour recevoir l'invitation automatique au quiz + entretien.
    matchThreshold: { type: Number, min: 0, max: 100, default: 60 },
    status: { type: String, enum: ['brouillon', 'publiee', 'fermee'], default: 'publiee' },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { versionKey: false, virtuals: true, transform(doc, ret) { ret.id = String(ret._id); delete ret._id; return ret; } } },
);

jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ title: 'text', description: 'text', requiredSkills: 'text' });

module.exports = mongoose.model('Job', jobSchema);
