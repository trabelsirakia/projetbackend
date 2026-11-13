const User = require('../../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/tokens');

const bearer = (req) => {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
};

/**
 * Vérifie le jeton d'accès puis recharge l'utilisateur à CHAQUE requête :
 * un compte bloqué ou un rôle modifié prend effet immédiatement.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const token = bearer(req);
  if (!token) throw new AppError('Authentification requise.', 401, 'AUTH_REQUIRED');
  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);
  if (!user) throw new AppError('Ce compte n\'existe plus.', 401, 'USER_NOT_FOUND');
  if (user.isBlocked) throw new AppError('Votre compte est bloqué. Contactez un administrateur.', 403, 'ACCOUNT_BLOCKED');
  req.user = user;
  next();
});

/** Authentification facultative (offres consultables sans compte) : un jeton invalide est simplement ignoré. */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = bearer(req);
  if (token) {
    try {
      const user = await User.findById(verifyAccessToken(token).sub);
      if (user && !user.isBlocked) req.user = user;
    } catch { /* visiteur anonyme */ }
  }
  next();
});

module.exports = { authenticate, optionalAuth };
