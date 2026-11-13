/** Utilisateurs (administration) : liste paginée/filtrée, création, rôle/blocage, suppression. */
const asyncHandler = require('../config/utils/asyncHandler');
const AppError = require('../config/utils/AppError');
const { paginate, compact } = require('../config/utils/listQuery');
const User = require('../models/User');

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, ...(message ? { message } : {}), data });

module.exports = {
  list: asyncHandler(async (req, res) => ok(res, await paginate(User, req.query, {
    searchFields: ['firstName', 'lastName', 'email'],
    sortFields: ['createdAt', 'lastName', 'email', 'role', 'lastLoginAt'],
    filters: (q) => compact({ role: q.role, isBlocked: q.blocked === undefined ? undefined : q.blocked === 'true' }),
  }))),
  create: asyncHandler(async (req, res) => {
    if (await User.exists({ email: req.body.email.toLowerCase() })) throw new AppError('Cet e-mail est déjà utilisé.', 409, 'DUPLICATE');
    ok(res, await User.create(req.body), 'Utilisateur créé.', 201);
  }),
  update: asyncHandler(async (req, res) => {
    if (String(req.params.id) === String(req.user._id) && (req.body.role || req.body.isBlocked)) throw new AppError('Vous ne pouvez pas modifier votre propre rôle ni vous bloquer.', 409, 'SELF_MODIFICATION');
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!user) throw new AppError('Utilisateur introuvable.', 404, 'USER_NOT_FOUND');
    if (req.body.isBlocked) await User.updateOne({ _id: user._id }, { refreshTokenId: null });
    ok(res, user, 'Utilisateur mis à jour.');
  }),
  remove: asyncHandler(async (req, res) => {
    if (String(req.params.id) === String(req.user._id)) throw new AppError('Vous ne pouvez pas supprimer votre propre compte.', 409, 'SELF_MODIFICATION');
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new AppError('Utilisateur introuvable.', 404, 'USER_NOT_FOUND');
    ok(res, null, 'Utilisateur supprimé.');
  }),
};
