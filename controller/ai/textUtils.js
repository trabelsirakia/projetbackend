/** Outils de texte partagés (frontières de mots Unicode : « \b » de JavaScript ignore les lettres accentuées). */

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Vrai si `term` apparaît comme mot (ou groupe de mots) entier dans `text`. */
function containsTerm(text, term) {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(term.toLowerCase())}(?![\\p{L}\\p{N}])`, 'iu');
  return re.test(text.toLowerCase());
}

/** Découpe en phrases (fin de phrase, retour à la ligne, puces). */
function sentences(text, { min = 3, max = 60 } = {}) {
  return String(text || '')
    .split(/(?<=[.!?;])\s+|\n+|\s[•·▪●-]\s/u)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.split(' ').length >= min)
    .map((s) => s.split(' ').slice(0, max).join(' '));
}

/** Fenêtres glissantes de `size` mots (pas `step`) : capte une idée exprimée au milieu d'une longue phrase orale. */
function windows(text, size = 14, step = 7) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length <= size) return words.length ? [words.join(' ')] : [];
  const out = [];
  for (let i = 0; i < words.length; i += step) {
    out.push(words.slice(i, i + size).join(' '));
    if (i + size >= words.length) break;
  }
  return out;
}

const wordCount = (text) => String(text || '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const round = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;

module.exports = { escapeRegex, containsTerm, sentences, windows, wordCount, clamp01, round };
