/**
 * Réponses RÉELLES dans la collection Postman : après chaque passage Newman, la réponse obtenue par chaque requête
 * est enregistrée dans exemples-reponses.json, puis attachée comme « Example » à la requête par build-postman.js.
 * Ainsi la collection importée dans l'application Postman montre déjà de vraies données (statut, en-têtes, corps JSON)
 * avant même d'être exécutée.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'exemples-reponses.json');
const MAX_STRING = 200; // longues chaînes (base64, jetons, HTML d'e-mail) raccourcies pour garder une collection légère
const MAX_ITEMS = 3; // tableaux raccourcis (listes paginées)

const MAX_DEPTH = 5; // objets imbriqués au-delà : résumés
const MAX_KEYS = 20; // objets très larges (spécification OpenAPI) : 20 premières clés

function shrink(value, depth = 0) {
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}… (${value.length} caractères)` : value;
  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return `[… ${value.length} élément(s)]`;
    const kept = value.slice(0, MAX_ITEMS).map((v) => shrink(v, depth + 1));
    if (value.length > MAX_ITEMS) kept.push(`… ${value.length - MAX_ITEMS} élément(s) de plus`);
    return kept;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (depth >= MAX_DEPTH) return `{… ${entries.length} champ(s)}`;
    const kept = Object.fromEntries(entries.slice(0, MAX_KEYS).map(([k, v]) => [k, shrink(v, depth + 1)]));
    if (entries.length > MAX_KEYS) kept['…'] = `${entries.length - MAX_KEYS} champ(s) de plus`;
    return kept;
  }
  return value;
}

/** newman.json → { "Dossier/Requête": { code, status, headers, body, ms, at } } (dernière exécution de chaque requête). */
function extract(newmanJsonPath) {
  const report = JSON.parse(fs.readFileSync(newmanJsonPath, 'utf8'));
  const pathById = {};
  const walk = (items, prefix) => items.forEach((it) => (it.item ? walk(it.item, `${prefix}${it.name}/`) : (pathById[it.id] = `${prefix}${it.name}`)));
  walk(report.collection.item, '');
  const out = {};
  for (const ex of report.run.executions) {
    const key = pathById[ex.item.id];
    const res = ex.response;
    if (!key || !res || !res.code) continue;
    const raw = Buffer.from(res.stream?.data || []).toString('utf8');
    let body = raw;
    try { body = JSON.stringify(shrink(JSON.parse(raw)), null, 2); } catch { body = shrink(raw); }
    out[key] = {
      code: res.code,
      status: res.status,
      ms: res.responseTime,
      headers: (res.header || []).filter((h) => /^(content-type|x-request-id|ratelimit-.*)$/i.test(h.key)).map(({ key: k, value }) => ({ key: k, value })),
      body,
      at: new Date().toISOString(),
    };
  }
  return out;
}

function save(newmanJsonPath, file = FILE) {
  const examples = extract(newmanJsonPath);
  fs.writeFileSync(file, JSON.stringify(examples, null, 1));
  return Object.keys(examples).length;
}

/** Attache à chaque requête de la collection la réponse réelle enregistrée (Postman : onglet « Examples »). */
function apply(collection, file = FILE) {
  if (!fs.existsSync(file)) return 0;
  const examples = JSON.parse(fs.readFileSync(file, 'utf8'));
  let n = 0;
  const walk = (items, prefix) => items.forEach((it) => {
    if (it.item) return walk(it.item, `${prefix}${it.name}/`);
    const ex = examples[`${prefix}${it.name}`];
    if (!ex) return undefined;
    it.response = [{
      name: `Réponse réelle ${ex.code} (${ex.ms} ms)`,
      originalRequest: { method: it.request.method, header: [], url: it.request.url },
      status: ex.status,
      code: ex.code,
      _postman_previewlanguage: /^\s*[{[]/.test(ex.body) ? 'json' : 'text',
      header: ex.headers,
      cookie: [],
      body: ex.body,
    }];
    n += 1;
    return undefined;
  });
  walk(collection.item, '');
  return n;
}

module.exports = { save, apply, FILE };
