const AppError = require('../utils/AppError');

/**
 * Valide req[source] avec un schéma Joi et remplace la valeur par la version nettoyée
 * (champs inconnus retirés, types convertis). Échec -> 422 avec la liste des champs fautifs.
 */
module.exports = (schema, source = 'body') => (req, res, next) => {
  const { value, error } = schema.validate(req[source] ?? {}, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const errors = error.details.map((d) => ({
      field: d.path.join('.') || source,
      message: d.message.replace(/"/g, ''),
    }));
    return next(new AppError('Les données envoyées sont invalides.', 422, 'VALIDATION_ERROR', errors));
  }

  req[source] = value;
  return next();
};
