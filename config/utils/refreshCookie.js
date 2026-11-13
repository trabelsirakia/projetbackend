const env = require('../env');
const { durationMs } = require('./tokens');

const COOKIE_NAME = 'tw_refresh';

// httpOnly : illisible en JavaScript ; envoyé uniquement à l'API (le changement de mot de passe
// sur /api/users/me/password en a besoin pour garder la session courante).
const options = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'strict',
  path: '/api',
});

function setRefreshCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...options(), maxAge: durationMs(env.jwt.refreshExpiry) });
}

function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, options());
}

// Jeton explicite du corps (Postman, Swagger, mobile) en priorité, sinon le cookie httpOnly du navigateur.
function readRefreshToken(req) {
  return req.body?.refreshToken || req.cookies?.[COOKIE_NAME] || null;
}

module.exports = { COOKIE_NAME, setRefreshCookie, clearRefreshCookie, readRefreshToken };
