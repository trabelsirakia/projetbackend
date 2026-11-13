/**
 * Erreur métier connue : elle porte un code HTTP et un code machine
 * que le frontend utilise pour afficher le bon message.
 */
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST', errors = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true;
  }
}

module.exports = AppError;
