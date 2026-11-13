import { useSyncExternalStore } from 'react';

/**
 * Thème de l'interface : « light », « dark » ou « system » (suit le réglage du téléphone ou de l'ordinateur).
 * L'attribut data-theme de <html> est posé avant React par /theme-init.js ; ce module le tient ensuite à jour,
 * mémorise le choix et suit les changements du système quand la préférence est « system ».
 */
const KEY = 'tw.theme';
const PREFS = ['light', 'dark', 'system'];
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set();

function readPreference() {
  try {
    const value = localStorage.getItem(KEY);
    return PREFS.includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

let preference = readPreference();
const resolve = (pref) => (pref === 'dark' || (pref === 'system' && media?.matches) ? 'dark' : 'light');
let snapshot = { preference, resolved: resolve(preference) };

function apply() {
  const resolved = resolve(preference);
  const root = document.documentElement;
  // Pas de transitions pendant la bascule : tout change d'un coup, sans clignotement.
  root.classList.add('theme-switching');
  root.setAttribute('data-theme', resolved);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0D1218' : '#F3F5F8');
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
  snapshot = { preference, resolved };
  listeners.forEach((l) => l());
}

media?.addEventListener?.('change', () => { if (preference === 'system') apply(); });
// Filet de sécurité : certains navigateurs n'émettent pas « change » pour un onglet en arrière-plan.
// Au retour sur l'application, on revérifie le réglage du système.
const recheck = () => { if (preference === 'system' && resolve(preference) !== snapshot.resolved) apply(); };
if (typeof window !== 'undefined') {
  window.addEventListener('focus', recheck);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recheck(); });
}
// Un autre onglet a changé le thème : on suit.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { preference = readPreference(); apply(); }
  });
}

export function setThemePreference(next) {
  if (!PREFS.includes(next)) return;
  preference = next;
  try { localStorage.setItem(KEY, next); } catch { /* choix non mémorisé, appliqué quand même */ }
  apply();
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const getSnapshot = () => snapshot;

export default function useTheme() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...state, setPreference: setThemePreference };
}
