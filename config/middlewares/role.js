const AppError = require('../utils/AppError');

// À placer après authenticate : autorise seulement les rôles listés.
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError('Authentification requise.', 401, 'AUTH_REQUIRED'));
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Vous n\'avez pas les droits pour cette action.', 403, 'FORBIDDEN'));
  }
  return next();
};

module.exports = { authorize };
