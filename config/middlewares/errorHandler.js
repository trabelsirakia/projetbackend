const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const env = require('../env');

const FIELD_LABELS = { email: 'Cet e-mail', code: 'Ce code' };

function notFound(req, res, next) {
  next(new AppError(`Route introuvable : ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

// Convertit les erreurs connues (Mongoose, JWT, JSON) en réponses claires et homogènes.
function normalize(err) {
  if (err instanceof AppError) return err;

  if (err instanceof mongoose.Error.CastError) {
    return new AppError(`Identifiant invalide : ${err.value}`, 400, 'INVALID_ID');
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return new AppError('Les données envoyées sont invalides.', 422, 'VALIDATION_ERROR', errors);
  }
  if (err && err.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'champ';
    const label = FIELD_LABELS[field] || `La valeur du champ "${field}"`;
    return new AppError(`${label} est déjà utilisé.`, 409, 'DUPLICATE', [{ field, message: 'Déjà utilisé' }]);
  }
  if (err && err.name === 'TokenExpiredError') {
    return new AppError('Votre session a expiré.', 401, 'TOKEN_EXPIRED');
  }
  if (err && (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError')) {
    return new AppError('Jeton invalide.', 401, 'INVALID_TOKEN');
  }
  if (err && err.type === 'entity.parse.failed') {
    return new AppError('Le corps de la requête n\'est pas un JSON valide.', 400, 'INVALID_JSON');
  }
  if (err && err.type === 'entity.too.large') {
    return new AppError('Requête trop volumineuse.', 413, 'PAYLOAD_TOO_LARGE');
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const known = normalize(err);

  if (!known) {
    logger.error(`${req.method} ${req.originalUrl} ->`, err);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: env.isProd ? 'Une erreur interne est survenue.' : `Erreur interne : ${err.message}`,
    });
  }

  if (known.statusCode >= 500) logger.error(`${req.method} ${req.originalUrl} ->`, known.message);

  const body = { success: false, code: known.code, message: known.message };
  if (known.errors) body.errors = known.errors;
  return res.status(known.statusCode).json(body);
}

module.exports = { notFound, errorHandler };
