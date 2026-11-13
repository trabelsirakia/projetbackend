const asyncHandler = require('../config/utils/asyncHandler');
const { setRefreshCookie, clearRefreshCookie, readRefreshToken } = require('../config/utils/refreshCookie');
const auth = require('./services/authService');
const User = require('../models/User');

// Le refresh token part en cookie httpOnly ; il est AUSSI renvoyé dans le corps pour Postman / Swagger.
const session = (res, status, message, { user, accessToken, refreshToken }) => {
  setRefreshCookie(res, refreshToken);
  res.status(status).json({ success: true, message, data: { user, accessToken, refreshToken } });
};

module.exports = {
  signup: asyncHandler(async (req, res) => session(res, 201, 'Compte créé.', await auth.signup(req.body))),
  login: asyncHandler(async (req, res) => session(res, 200, 'Connexion réussie.', await auth.login(req.body))),
  refresh: asyncHandler(async (req, res) => session(res, 200, 'Session renouvelée.', await auth.refresh(readRefreshToken(req)))),
  logout: asyncHandler(async (req, res) => {
    await auth.logout(req.user._id);
    clearRefreshCookie(res);
    res.json({ success: true, message: 'Déconnexion réussie.' });
  }),
  forgotPassword: asyncHandler(async (req, res) => {
    await auth.forgotPassword(req.body.email);
    res.json({ success: true, message: 'Si un compte existe pour cet e-mail, un lien de réinitialisation vient d\'être envoyé.' });
  }),
  resetPassword: asyncHandler(async (req, res) => {
    await auth.resetPassword(req.body.token, req.body.password);
    clearRefreshCookie(res);
    res.json({ success: true, message: 'Mot de passe modifié : connectez-vous avec le nouveau.' });
  }),
  me: (req, res) => res.json({ success: true, data: { user: req.user } }),
  updateMe: asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.user._id, req.body, { new: true, runValidators: true });
    res.json({ success: true, message: 'Profil mis à jour.', data: { user } });
  }),
  changePassword: asyncHandler(async (req, res) => session(res, 200, 'Mot de passe modifié.', await auth.changePassword(req.user._id, req.body.currentPassword, req.body.newPassword))),
};
