// Petit logger horodaté. Silencieux pendant les tests sauf pour les erreurs.
const isTest = process.env.NODE_ENV === 'test';

// Heure locale au format AAAA-MM-JJ HH:MM:SS.
const stamp = () => new Date().toLocaleString('sv-SE');

module.exports = {
  info: (...args) => { if (!isTest) console.log(`[${stamp()}] INFO `, ...args); },
  warn: (...args) => { if (!isTest) console.warn(`[${stamp()}] WARN `, ...args); },
  error: (...args) => console.error(`[${stamp()}] ERROR`, ...args),
};
