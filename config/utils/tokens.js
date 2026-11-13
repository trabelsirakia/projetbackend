const jwt = require('jsonwebtoken');
const ms = require('ms');
const env = require('../env');
const AppError = require('./AppError');

const ISSUER = 'talentwave-api';
const TEMP_2FA_EXPIRY = '5m';
const RESET_EXPIRY = '15m';

// Chaque jeton porte un "type" : impossible d'utiliser un jeton 2FA ou de reset comme jeton d'accès.
function verifyTyped(token, secret, expectedType, expiredMessage) {
  let payload;
  try {
    payload = jwt.verify(token, secret, { issuer: ISSUER });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new AppError(expiredMessage, 401, 'TOKEN_EXPIRED');
    throw new AppError('Jeton invalide.', 401, 'INVALID_TOKEN');
  }
  if (payload.type !== expectedType) throw new AppError('Jeton invalide.', 401, 'INVALID_TOKEN');
  return payload;
}

const signAccessToken = (user) => jwt.sign(
  { sub: user.id, role: user.role, type: 'access' },
  env.jwt.accessSecret,
  { expiresIn: env.jwt.accessExpiry, issuer: ISSUER },
);

const verifyAccessToken = (token) => verifyTyped(token, env.jwt.accessSecret, 'access', 'Votre session a expiré.');

const signRefreshToken = (userId, jti) => jwt.sign(
  { sub: String(userId), jti, type: 'refresh' },
  env.jwt.refreshSecret,
  { expiresIn: env.jwt.refreshExpiry, issuer: ISSUER },
);

const verifyRefreshToken = (token) => verifyTyped(token, env.jwt.refreshSecret, 'refresh', 'Session expirée, reconnectez-vous.');

const signTempToken = (user) => jwt.sign(
  { sub: user.id, type: '2fa' },
  env.jwt.accessSecret,
  { expiresIn: TEMP_2FA_EXPIRY, issuer: ISSUER },
);

const verifyTempToken = (token) => verifyTyped(token, env.jwt.accessSecret, '2fa', 'Délai de saisie du code dépassé, reconnectez-vous.');

/**
 * Jeton de réinitialisation : signé avec JWT_SECRET + hash actuel du mot de passe.
 * Dès que le mot de passe change, le jeton devient invalide -> usage unique, sans champ en base.
 */
const resetSecret = (user) => `${env.jwt.accessSecret}.${user.password}`;

// expiresIn : 15 min pour « mot de passe oublié », plus long pour une invitation créée par un admin.
const signResetToken = (user, expiresIn = RESET_EXPIRY) => jwt.sign(
  { sub: user.id, type: 'reset' },
  resetSecret(user),
  { expiresIn, issuer: ISSUER },
);

// Lit l'identifiant sans vérifier la signature (pour charger le bon utilisateur), puis vérifie.
const peekSubject = (token) => {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded.sub !== 'string') throw new AppError('Lien de réinitialisation invalide.', 400, 'INVALID_TOKEN');
  return decoded.sub;
};

const verifyResetToken = (token, user) => {
  try {
    return verifyTyped(token, resetSecret(user), 'reset', 'Ce lien a expiré. Faites une nouvelle demande.');
  } catch (err) {
    if (err.code === 'TOKEN_EXPIRED') throw new AppError(err.message, 400, 'TOKEN_EXPIRED');
    throw new AppError('Ce lien est invalide ou a déjà été utilisé.', 400, 'INVALID_TOKEN');
  }
};

const durationMs = (value) => {
  const out = ms(value);
  if (typeof out !== 'number') throw new Error(`Durée invalide : ${value}`);
  return out;
};

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signTempToken,
  verifyTempToken,
  signResetToken,
  verifyResetToken,
  peekSubject,
  durationMs,
  RESET_EXPIRY,
};
