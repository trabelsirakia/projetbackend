/**
 * Données RÉELLES du projet, à emporter avec le zip : export / import complet de la base MongoDB.
 *
 *   npm run data:export            → models/donnees/talentwave_live.json (toutes les collections)
 *   npm run data:import            → recharge ce fichier si la base est VIDE (sinon rien n'est touché)
 *   npm run data:import -- --force → remplace la base par le contenu du fichier
 *
 * Format Extended JSON (EJSON) : les types sont conservés à l'identique (ObjectId, dates, CV PDF en binaire),
 * donc comptes, offres, quiz, passages, candidatures, entretiens, transcriptions et notes reviennent tels quels.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const env = require('../config/env');

const FILE = path.join(__dirname, 'donnees', 'talentwave_live.json');
const mode = process.argv[2];
const force = process.argv.includes('--force');

async function exportData() {
  const db = mongoose.connection.db;
  const names = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.')).sort();
  const data = { exportedAt: new Date(), database: db.databaseName, collections: {} };
  for (const name of names) data.collections[name] = await db.collection(name).find({}).toArray();
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, EJSON.stringify(data, null, 1, { relaxed: false }));
  const summary = names.map((n) => `${n} ${data.collections[n].length}`).join(', ');
  console.log(`Export : ${FILE}\n  ${summary}\n  ${(fs.statSync(FILE).size / 1024).toFixed(0)} Ko`);
}

async function importData() {
  if (!fs.existsSync(FILE)) {
    console.log(`Aucun fichier de données (${FILE}) : rien à importer.`);
    process.exitCode = 2;
    return;
  }
  const db = mongoose.connection.db;
  const existing = await db.collection('users').countDocuments().catch(() => 0);
  if (existing && !force) {
    console.log(`La base ${db.databaseName} contient déjà ${existing} compte(s) : rien n'est modifié (--force pour la remplacer).`);
    return;
  }
  const data = EJSON.parse(fs.readFileSync(FILE, 'utf8'), { relaxed: false });
  for (const [name, docs] of Object.entries(data.collections)) {
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });
  }
  const summary = Object.entries(data.collections).map(([n, d]) => `${n} ${d.length}`).join(', ');
  console.log(`Import dans ${db.databaseName} (export du ${new Date(data.exportedAt).toLocaleString('fr-FR')}) :\n  ${summary}`);
}

(async () => {
  if (!['export', 'import'].includes(mode)) {
    console.log('Usage : node models/donnees.js export | import [--force]');
    process.exit(1);
  }
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  try {
    await (mode === 'export' ? exportData() : importData());
  } finally {
    await mongoose.disconnect();
  }
})().catch((err) => { console.error(`Échec ${mode} : ${err.message}`); process.exit(1); });
