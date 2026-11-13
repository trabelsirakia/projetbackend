/**
 * Envoie la collection (avec ses réponses réelles) et l'environnement de test dans l'APPLICATION Postman
 * (votre espace de travail), via l'API officielle Postman. Met à jour s'ils existent déjà, sinon les crée.
 *
 *   npm run postman:push            (clé lue dans .env : POSTMAN_API_KEY=PMAK-...)
 *   Clé : Postman > avatar > Settings > API keys > Generate API Key.
 *   Facultatif : POSTMAN_WORKSPACE_ID=... (sinon : espace de travail par défaut / le premier de la liste)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
require(path.join(ROOT, 'node_modules', 'dotenv')).config({ path: path.join(ROOT, '.env'), quiet: true });
const KEY = (process.env.POSTMAN_API_KEY || '').trim();
const API = 'https://api.getpostman.com';
const COLLECTION = path.join(__dirname, 'TalentWave-Live.postman_collection.json');
const ENVIRONMENT = path.join(__dirname, 'TalentWave-Live-test.postman_environment.json');

async function call(method, url, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { 'X-Api-Key': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${data.error?.message || JSON.stringify(data).slice(0, 300)}`);
  return data;
}

(async () => {
  if (!KEY) {
    console.error('POSTMAN_API_KEY manquante : ajoutez POSTMAN_API_KEY=PMAK-... dans le fichier .env (Postman > Settings > API keys).');
    process.exit(1);
  }
  const me = await call('GET', '/me');
  let workspace = process.env.POSTMAN_WORKSPACE_ID;
  if (!workspace) {
    const { workspaces = [] } = await call('GET', '/workspaces');
    workspace = (workspaces.find((w) => w.type === 'personal') || workspaces[0])?.id;
  }
  const ws = workspace ? `?workspace=${workspace}` : '';
  console.log(`Compte Postman : ${me.user?.username || me.user?.id} · espace de travail ${workspace || '(par défaut)'}`);

  // Rebuild pour embarquer les dernières réponses réelles.
  require('./build-postman');
  const collection = JSON.parse(fs.readFileSync(COLLECTION, 'utf8'));
  const environment = JSON.parse(fs.readFileSync(ENVIRONMENT, 'utf8'));
  delete collection.info._postman_id;

  const { collections = [] } = await call('GET', `/collections${ws}`);
  const existing = collections.find((c) => c.name === collection.info.name);
  if (existing) {
    await call('PUT', `/collections/${existing.uid}`, { collection });
    console.log(`✔ Collection mise à jour : ${collection.info.name}`);
  } else {
    await call('POST', `/collections${ws}`, { collection });
    console.log(`✔ Collection créée : ${collection.info.name}`);
  }

  const env = { name: environment.name, values: environment.values.map(({ key, value, enabled }) => ({ key, value, enabled, type: 'default' })) };
  const { environments = [] } = await call('GET', `/environments${ws}`);
  const existingEnv = environments.find((e) => e.name === env.name);
  if (existingEnv) {
    await call('PUT', `/environments/${existingEnv.uid}`, { environment: env });
    console.log(`✔ Environnement mis à jour : ${env.name}`);
  } else {
    await call('POST', `/environments${ws}`, { environment: env });
    console.log(`✔ Environnement créé : ${env.name}`);
  }
  console.log('\nDans Postman : la collection apparaît dans Collections (synchronisation automatique).');
  console.log('Chaque requête a un « Example » = réponse réelle. Pour exécuter : SERVEUR_POSTMAN.bat, puis Run collection.');
})().catch((err) => { console.error(`✖ ${err.message}`); process.exit(1); });
