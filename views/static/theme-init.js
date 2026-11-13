/*
 * Applique le thème avant l'affichage de la page (pas de flash blanc en thème sombre).
 * Fichier externe et non script en ligne : la politique de sécurité (CSP) interdit les scripts en ligne.
 * Préférence : localStorage « tw.theme » = light | dark | system (par défaut : celui du système).
 */
(function () {
  var root = document.documentElement;
  var pref = 'system';
  try { pref = localStorage.getItem('tw.theme') || 'system'; } catch (e) { /* stockage indisponible */ }
  var dark = pref === 'dark' || (pref !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0D1218' : '#F3F5F8');
}());
