/**
 * Liste paginée commune (CRUD) : recherche plein texte insensible aux accents et à la casse sur plusieurs champs,
 * filtres exacts / plages, tri sur une liste blanche de champs, pagination bornée.
 *
 *   GET /api/quizzes?q=react&metier=dev-fullstack&status=actif&sort=-createdAt&page=2&limit=10
 *
 * Réponse : { items, pagination: { page, limit, total, pages, hasNext, hasPrev }, sort, filters }
 */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Recherche tolérante aux accents : « developpeur » trouve « Développeur ».
const ACCENTS = { a: 'aàâä', e: 'eéèêë', i: 'iîï', o: 'oôö', u: 'uùûü', c: 'cç' };
function accentInsensitive(text) {
  return escapeRegex(text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())
    .replace(/[aeiouc]/g, (ch) => `[${ACCENTS[ch]}]`);
}

function parseSort(sort, allowed, fallback) {
  const fields = String(sort || fallback).split(',').map((s) => s.trim()).filter(Boolean);
  const out = {};
  for (const f of fields) {
    const desc = f.startsWith('-');
    const name = desc ? f.slice(1) : f;
    if (allowed.includes(name)) out[name] = desc ? -1 : 1;
  }
  if (!Object.keys(out).length) return parseSort(fallback, allowed, fallback);
  if (!out._id) out._id = -1; // ordre stable entre deux pages
  return out;
}

/**
 * @param model     modèle Mongoose
 * @param query     req.query déjà validé (page, limit, q, sort + filtres)
 * @param options   { searchFields, sortFields, defaultSort, baseFilter, filters: (query) => filtreMongo, populate, select }
 */
async function paginate(model, query, options) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const filter = { ...(options.baseFilter || {}), ...(options.filters ? options.filters(query) : {}) };
  if (query.q && options.searchFields?.length) {
    const re = new RegExp(accentInsensitive(String(query.q).trim().slice(0, 80)), 'i');
    filter.$or = options.searchFields.map((f) => ({ [f]: re }));
  }
  const sort = parseSort(query.sort, options.sortFields, options.defaultSort || '-createdAt');
  // Collation française (force 2) : tri alphabétique réel, insensible à la casse (« de… » entre « CRUD… » et « UI… »),
  // accents ordonnés comme en français ; sans elle MongoDB trie par code binaire (majuscules d'abord).
  let cursor = model.find(filter).collation({ locale: 'fr', strength: 2 }).sort(sort).skip((page - 1) * limit).limit(limit);
  if (options.select) cursor = cursor.select(options.select);
  for (const p of options.populate || []) cursor = cursor.populate(p);
  const [items, total] = await Promise.all([cursor, model.countDocuments(filter)]);
  const pages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    pagination: { page, limit, total, pages, hasNext: page < pages, hasPrev: page > 1 },
    sort,
  };
}

/** Ajoute une plage { $gte, $lte } si min/max sont fournis. */
function range(min, max, cast = Number) {
  const r = {};
  if (min !== undefined && min !== '') r.$gte = cast(min);
  if (max !== undefined && max !== '') r.$lte = cast(max);
  return Object.keys(r).length ? r : undefined;
}

const compact = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== ''));

module.exports = { paginate, range, compact, accentInsensitive };
