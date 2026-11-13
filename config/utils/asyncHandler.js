// Transmet les erreurs des contrôleurs async au gestionnaire d'erreurs central (Express 4).
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
