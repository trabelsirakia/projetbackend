/**
 * Lanceur des tests Postman (Newman) sur une INSTANCE DE TEST ISOLÉE : la base de développement n'est jamais touchée.
 *
 *   TESTER_POSTMAN.bat (double-clic)   ou   npm run postman:run
 *
 * Étapes : MongoDB / Ollama vérifiés → collection régénérée → base « talentwave_live_postman » remplie par le seed
 * → serveur de test (port 8201, e-mails RÉELLEMENT envoyés et journalisés) → collection complète → rapport-postman.pdf à la racine
 * (résultat de CHAQUE requête et de chaque test) → arrêt du serveur, suppression de la base de test.
 *
 * Options :
 *   --serveur       mode APPLICATION POSTMAN : prépare la base, démarre le serveur sur 8201 et le laisse tourner
 *                   (importer la collection + l'environnement « test » dans Postman, puis Runner) ; Ctrl+C pour arrêter
 *   --sans-ia       sans le LLM (Ollama) : notation par embeddings seule (Whisper et MiniLM restent utilisés)
 *   --emails-captures  e-mails construits mais NON envoyés (par défaut : réellement envoyés par SMTP et vérifiés)
 *   --garder        garde la base de test à la fin
 *   --ouvrir        ouvre le PDF à la fin
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const HERE = __dirname;
const REPORTS = path.join(HERE, 'rapports');
const PDF = path.join(ROOT, 'rapport-postman.pdf');
const args = new Set(process.argv.slice(2));
const OPT = { serveur: args.has('--serveur'), sansIa: args.has('--sans-ia'), vraisEmails: !args.has('--emails-captures'), garder: args.has('--garder'), ouvrir: args.has('--ouvrir') };
const PORT = 8201;

process.chdir(ROOT);
const env = require(path.join(ROOT, 'config', 'env'));
const C = { ok: '\x1b[32m', ko: '\x1b[31m', warn: '\x1b[33m', b: '\x1b[1m', d: '\x1b[2m', x: '\x1b[0m' };
let n = 0;
const step = (t) => console.log(`\n${C.b}${++n}. ${t}${C.x}`);
const ok = (t) => console.log(`   ${C.ok}✔${C.x} ${t}`);
const warn = (t) => console.log(`   ${C.warn}!${C.x} ${t}`);
const fail = (t) => console.log(`   ${C.ko}✖${C.x} ${t}`);

const uri = new URL(env.mongoUri);
uri.pathname = `/${uri.pathname.replace('/', '') || 'talentwave_live'}_postman`;
const TEST_URI = uri.toString();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function health(base, ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(`${base}/api/health`); if (r.ok) return true; } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

async function dropTestDb() {
  const mongoose = require(path.join(ROOT, 'node_modules', 'mongoose'));
  const conn = await mongoose.createConnection(TEST_URI, { serverSelectionTimeoutMS: 4000 }).asPromise();
  await conn.dropDatabase();
  await conn.close();
}

function edgePath() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function htmlReport({ summary, executions, started, aiStatus }) {
  const s = summary.run.stats;
  const failures = summary.run.failures.length;
  const rows = executions.map((e) => {
    const asserts = (e.assertions || []).map((a) => `<li class="${a.error ? 'ko' : 'ok'}">${a.error ? '✖' : '✔'} ${esc(a.assertion)}${a.error ? ` — <em>${esc(a.error.message)}</em>` : ''}</li>`).join('');
    const okAll = (e.assertions || []).every((a) => !a.error);
    return `<tr class="${okAll ? '' : 'bad'}"><td>${esc(e.item.name)}</td><td><code>${esc(e.request.method)} ${esc(e.request.url.toString().replace(/^https?:\/\/[^/]+/, ''))}</code></td><td>${e.response ? e.response.code : '—'}</td><td>${e.response ? e.response.responseTime : '—'} ms</td><td><ul>${asserts}</ul></td></tr>`;
  }).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport Postman — TalentWave Live</title><style>
  body{font-family:Segoe UI,Arial,sans-serif;color:#15202D;margin:28px;font-size:12px} h1{color:#0F2238;margin:0} .sub{color:#56626F}
  .kpi{display:flex;gap:12px;margin:18px 0} .kpi div{border:1px solid #E1E5EB;border-radius:8px;padding:10px 14px} .kpi b{font-size:20px;display:block}
  table{border-collapse:collapse;width:100%} th,td{border-bottom:1px solid #E1E5EB;padding:6px;text-align:left;vertical-align:top} th{background:#F3F5F8}
  tr.bad td{background:#FCEDEC} ul{margin:0;padding-left:14px} li.ok{color:#1D7348} li.ko{color:#BC312A} code{font-size:11px}
  .ok{color:#1D7348} .ko{color:#BC312A}</style></head><body>
  <h1>Rapport des tests Postman — TalentWave Live</h1>
  <p class="sub">Exécuté le ${new Date(started).toLocaleString('fr-FR')} · durée ${Math.round((Date.now() - started) / 1000)} s · instance de test isolée (port ${PORT}, base ${esc(TEST_URI.split('/').pop())}) · IA générative : ${OPT.sansIa ? 'désactivée (--sans-ia)' : esc(aiStatus)}</p>
  <div class="kpi"><div><b>${s.requests.total}</b>requêtes</div><div><b>${s.assertions.total}</b>tests</div><div><b class="${failures ? 'ko' : 'ok'}">${s.assertions.total - s.assertions.failed}/${s.assertions.total}</b>tests réussis</div><div><b class="${failures ? 'ko' : 'ok'}">${failures ? `${failures} échec(s)` : 'Aucun échec'}</b>résultat</div></div>
  <table><thead><tr><th>Requête</th><th>Appel</th><th>Code</th><th>Temps</th><th>Tests</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

(async () => {
  const started = Date.now();
  fs.mkdirSync(REPORTS, { recursive: true });
  if (!OPT.serveur && fs.existsSync(PDF)) fs.unlinkSync(PDF);

  step('Vérifications');
  try {
    const mongoose = require(path.join(ROOT, 'node_modules', 'mongoose'));
    const c = await mongoose.createConnection(env.mongoUri, { serverSelectionTimeoutMS: 3000 }).asPromise();
    await c.close();
    ok('MongoDB démarré');
  } catch {
    fail('MongoDB injoignable : démarrez le service « MongoDB » puis relancez.');
    process.exit(1);
  }
  let aiStatus = 'non vérifiée';
  if (!OPT.sansIa) {
    try {
      const r = await fetch(`${env.ollama.host}/api/tags`);
      const names = (await r.json()).models.map((m) => m.name);
      aiStatus = names.some((x) => x.startsWith(env.ollama.model.split(':')[0])) ? `Ollama ${env.ollama.model}` : 'modèle absent';
      ok(`Ollama : ${aiStatus}`);
    } catch {
      OPT.sansIa = true;
      warn('Ollama injoignable : exécution sans IA générative (notation par embeddings seule).');
    }
  }

  step('Collection Postman régénérée');
  delete require.cache[require.resolve('./build-postman')];
  const { count } = require('./build-postman');
  ok(`${count} requêtes`);

  step(`Base de test ${TEST_URI.split('/').pop()} (la base de développement n'est pas touchée)`);
  const childEnv = {
    ...process.env, MONGODB_URI: TEST_URI, PORT: String(PORT), MAIL_CAPTURE: OPT.vraisEmails ? '0' : '1', MAIL_JOURNAL: OPT.vraisEmails ? '1' : '0', AI_OFFLINE: OPT.sansIa ? '1' : '0', NODE_ENV: 'development',
    RATE_LIMIT_LOGIN_MAX: '1000', RATE_LIMIT_SIGNUP_MAX: '1000', RATE_LIMIT_FORGOT_MAX: '1000', RATE_LIMIT_APPLY_MAX: '1000', RATE_LIMIT_CHAT_MAX: '1000', RATE_LIMIT_AI_MAX: '1000', ACCESS_TOKEN_EXPIRY: '2h',
  };
  const seeded = spawnSync(process.execPath, ['models/seed.js', '--force'], { env: childEnv, encoding: 'utf8' });
  if (seeded.status !== 0) { fail(`Seed en échec :\n${seeded.stderr || seeded.stdout}`); process.exit(1); }
  ok('Données de démonstration chargées');

  step(`Serveur de test sur http://localhost:${PORT}`);
  const log = fs.openSync(path.join(REPORTS, 'serveur.log'), 'w');
  const server = spawn(process.execPath, ['app.js'], { env: childEnv, stdio: ['ignore', log, log] });
  const stop = async () => {
    server.kill();
    if (!OPT.garder) { await dropTestDb().catch(() => {}); ok('Base de test supprimée'); }
  };
  process.on('SIGINT', async () => { await stop(); process.exit(0); });
  if (!(await health(`http://localhost:${PORT}`))) { fail(`Le serveur de test ne répond pas (voir ${path.join(REPORTS, 'serveur.log')})`); await stop(); process.exit(1); }
  ok(`Prêt (e-mails ${OPT.vraisEmails ? 'RÉELLEMENT envoyés par SMTP' : 'capturés'}, Swagger : http://localhost:${PORT}/api-docs)`);

  if (OPT.serveur) {
    console.log(`\n${C.b}Mode application Postman${C.x}
   1. Postman > Import : ${path.join(HERE, 'TalentWave-Live.postman_collection.json')}
                         ${path.join(HERE, 'TalentWave-Live-test.postman_environment.json')}
   2. Choisir l'environnement « TalentWave Live (test, port 8201) » en haut à droite.
   3. Clic droit sur la collection > Run collection > Run (ordre conservé).
   Laissez cette fenêtre ouverte ; Ctrl+C arrête le serveur et supprime la base de test.`);
    return;
  }

  step('Exécution de la collection (Newman)');
  const newman = require(path.join(ROOT, 'node_modules', 'newman'));
  const summary = await new Promise((resolve, reject) => {
    newman.run({
      collection: path.join(HERE, 'TalentWave-Live.postman_collection.json'),
      environment: path.join(HERE, 'TalentWave-Live-test.postman_environment.json'),
      envVar: [{ key: 'baseUrl', value: `http://localhost:${PORT}` }],
      reporters: ['cli', 'json'],
      reporter: { json: { export: path.join(REPORTS, 'newman.json') } },
      timeoutRequest: 180000,
    }, (err, sum) => (err ? reject(err) : resolve(sum)));
  }).catch(async (err) => { fail(err.message); await stop(); process.exit(1); });
  // Les tentatives intermédiaires de l'attente de l'évaluation (sans test) ne figurent pas dans le rapport.
  const visible = summary.run.executions.filter((e) => (e.assertions || []).length || !e.item.name.startsWith('Attendre'));

  // Réponses réelles enregistrées puis attachées à la collection (onglet « Examples » de l'application Postman).
  const saved = require('./examples').save(path.join(REPORTS, 'newman.json'));
  delete require.cache[require.resolve('./build-postman')];
  const rebuilt = require('./build-postman');
  ok(`${saved} réponses réelles enregistrées, ${rebuilt.withExamples} attachées à la collection`);

  step('Rapport PDF');
  const html = path.join(os.tmpdir(), 'talentwave-live-rapport-postman.html');
  fs.writeFileSync(html, htmlReport({ summary, executions: visible, started, aiStatus }));
  fs.copyFileSync(html, path.join(REPORTS, 'rapport-postman.html'));
  const browser = edgePath();
  if (browser) {
    spawnSync(browser, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${PDF}`, `file:///${html.replace(/\\/g, '/')}`], { timeout: 60000 });
    if (fs.existsSync(PDF)) ok(`rapport-postman.pdf (${PDF})`); else warn(`PDF non produit : rapport HTML dans ${path.join(REPORTS, 'rapport-postman.html')}`);
  } else warn(`Edge/Chrome introuvable : rapport HTML dans ${path.join(REPORTS, 'rapport-postman.html')}`);

  await stop();
  const st = summary.run.stats.assertions;
  console.log(`\n${st.failed ? C.ko : C.ok}${C.b}${st.total - st.failed}/${st.total} tests réussis${C.x} (${summary.run.stats.requests.total} requêtes, ${Math.round((Date.now() - started) / 1000)} s)`);
  if (OPT.ouvrir && fs.existsSync(PDF)) {
    // cmd par son chemin complet (ComSpec) : certains PC n'ont pas System32 dans PATH ; un échec d'ouverture n'est pas bloquant.
    const shell = process.env.ComSpec || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
    const opener = spawn(shell, ['/c', 'start', '', PDF], { detached: true, stdio: 'ignore' });
    opener.on('error', () => console.log(`   Rapport : ${PDF}`));
    opener.unref();
  }
  process.exitCode = st.failed ? 1 : 0;
})();
