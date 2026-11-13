const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 12;
const ROLES = ['candidat', 'recruteur', 'admin'];

/**
 * Utilisateur : candidat (postule, passe quiz et entretien), recruteur (offres, quiz, décisions), admin.
 * Le mot de passe oublié n'a pas besoin de champ : le jeton de réinitialisation est signé avec le hash actuel
 * du mot de passe (usage unique, voir config/utils/tokens.js).
 */
const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: {
      type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'candidat' },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
    preferredLanguage: { type: String, enum: ['fr', 'en'], default: 'fr' },
    isBlocked: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
    refreshTokenId: { type: String, default: null, select: false },
    // Jeton précédent, encore accepté quelques secondes après une rotation (rechargement interrompu, 2 onglets).
    previousRefreshTokenId: { type: String, default: null, select: false },
    refreshRotatedAt: { type: Date, default: null, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.password;
        delete ret.refreshTokenId;
        delete ret.previousRefreshTokenId;
        delete ret.refreshRotatedAt;
        return ret;
      },
    },
  },
);

userSchema.index({ role: 1, createdAt: -1 });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
