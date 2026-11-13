/**
 * Options Helmet (en-têtes de sécurité HTTP).
 *  - CSP par défaut de Helmet + workers du site (service worker de l'application mobile, worker blob: des confettis)
 *    + cadres blob: (le CV PDF est affiché au RH depuis la mémoire du navigateur, jamais par un lien public) ;
 *    pas d'upgrade-insecure-requests : l'accès en HTTP sur le réseau local (port 8000) doit rester possible.
 *  - HSTS en production seulement (vrai domaine, vrai HTTPS). En local il serait nuisible : reçu sur
 *    https://localhost:8443, il forcerait le HTTPS sur « localhost » pour TOUS les ports et casserait
 *    http://localhost:5173 (Vite) et http://localhost:8000.
 */
module.exports = function helmetOptions(isProd) {
  return {
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    contentSecurityPolicy: { directives: { 'worker-src': ["'self'", 'blob:'], 'frame-src': ["'self'", 'blob:'], 'upgrade-insecure-requests': null } },
  };
};
