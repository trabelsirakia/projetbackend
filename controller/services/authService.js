const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../../models/User');
const AppError = require('../../config/utils/AppError');
const env = require('../../config/env');
const tokens = require('../../config/utils/tokens');
const mail = require('./emailService');

/**
 * Authentification : inscription, connexion, rotation du refresh token (un seul actif par compte, révoqué
 * à la déconnexion et au changement de mot de passe), mot de passe oublié par lien signé à usage unique.
 */
const DUMMY_HASH = bcrypt.hashSync('compte-inexistant', 12);

// Délai pendant lequel le jeton remplacé par une rotation reste valable : un rechargement de page interrompu
// (réponse /refresh perdue, ancien cookie conservé) ou deux onglets qui se rafraîchissent en même temps
// ne doivent pas déconnecter l'utilisateur. Une révocation (déconnexion, mot de passe, blocage) l'annule.
const ROTATION_GRACE_MS = 30 * 1000;

async function issueTokens(user, { rotatedFrom = null } = {}) {
  const jti = crypto.randomUUID();
  await User.updateOne({ _id: user._id }, {
    refreshTokenId: jti,
    previousRefreshTokenId: rotatedFrom,
    refreshRotatedAt: rotatedFrom ? new Date() : null,
    lastLoginAt: new Date(),
  });
  return { accessToken: tokens.signAccessToken(user), refreshToken: tokens.signRefreshToken(user._id, jti) };
}

async function signup({ firstName, lastName, email, password, phone, preferredLanguage }) {
  if (await User.exists({ email: email.toLowerCase() })) throw new AppError('Cet e-mail est déjà utilisé.', 409, 'DUPLICATE', [{ field: 'email', message: 'Déjà utilisé' }]);
  const user = await User.create({ firstName, lastName, email, password, phone, preferredLanguage, role: 'candidat' });
  mail.sendLater(user.email, 'welcome', { firstName: user.firstName, loginUrl: `${env.frontendUrl}/offres` });
  return { user, ...(await issueTokens(user)) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  // Même message et même coût (bcrypt) que le compte existe ou non : pas d'énumération des comptes.
  const ok = user ? await user.comparePassword(password) : await bcrypt.compare(password, DUMMY_HASH);
  if (!user || !ok) throw new AppError('E-mail ou mot de passe incorrect.', 401, 'INVALID_CREDENTIALS');
  if (user.isBlocked) throw new AppError('Votre compte est bloqué. Contactez un administrateur.', 403, 'ACCOUNT_BLOCKED');
  return { user, ...(await issueTokens(user)) };
}

async function refresh(refreshToken) {
  if (!refreshToken) throw new AppError('Session expirée, reconnectez-vous.', 401, 'NO_REFRESH_TOKEN');
  const payload = tokens.verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.sub).select('+refreshTokenId +previousRefreshTokenId +refreshRotatedAt');
  const isCurrent = user && user.refreshTokenId === payload.jti;
  const isRecentPrevious = user && user.refreshTokenId // null = session révoquée : plus de délai de grâce
    && user.previousRefreshTokenId === payload.jti
    && user.refreshRotatedAt && Date.now() - user.refreshRotatedAt.getTime() < ROTATION_GRACE_MS;
  if (!isCurrent && !isRecentPrevious) throw new AppError('Session expirée, reconnectez-vous.', 401, 'REFRESH_REVOKED');
  if (user.isBlocked) throw new AppError('Votre compte est bloqué.', 403, 'ACCOUNT_BLOCKED');
  return { user, ...(await issueTokens(user, { rotatedFrom: user.refreshTokenId })) };
}

async function logout(userId) {
  await User.updateOne({ _id: userId }, { refreshTokenId: null });
}

async function forgotPassword(email) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  // Réponse identique que le compte existe ou non.
  if (user && !user.isBlocked) {
    const token = tokens.signResetToken(user);
    mail.sendLater(user.email, 'resetPassword', { firstName: user.firstName, resetUrl: `${env.frontendUrl}/reinitialiser-mot-de-passe?token=${token}` });
  }
}

async function resetPassword(token, password) {
  const user = await User.findById(tokens.peekSubject(token)).select('+password');
  if (!user) throw new AppError('Ce lien est invalide ou a déjà été utilisé.', 400, 'INVALID_TOKEN');
  tokens.verifyResetToken(token, user);
  user.password = password;
  user.refreshTokenId = null; // toutes les sessions sont fermées
  await user.save();
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+password');
  if (!(await user.comparePassword(currentPassword))) throw new AppError('Mot de passe actuel incorrect.', 400, 'WRONG_PASSWORD');
  user.password = newPassword;
  await user.save();
  return { user, ...(await issueTokens(user)) };
}

module.exports = { signup, login, refresh, logout, forgotPassword, resetPassword, changePassword };
