/**
 * npm test : contrôles rapides sans serveur ni base.
 *  - architecture imposée de la racine (MVC du module) ;
 *  - logique métier IA pure : expérience du CV, décodage WAV, recommandation, notation sans modèle.
 * Le parcours HTTP complet est couvert par la collection Postman (TESTER_POSTMAN.bat, 201 tests).
 */
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

test('La racine respecte l\'architecture MVC imposée', () => {
  const dirs = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules').map((d) => d.name).sort();
  assert.deepStrictEqual(dirs, ['config', 'controller', 'models', 'public', 'routes', 'views']);
  for (const f of ['app.js', 'package.json', 'README.md']) assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} manquant`);
});

test('Expérience : périodes fusionnées sans double compte', () => {
  const { experienceYears } = require('../../controller/ai/matching');
  const year = new Date().getFullYear();
  assert.strictEqual(experienceYears('2018 - 2020 : stage\n2019 - 2021 : emploi'), 3);
  assert.strictEqual(experienceYears(`${year - 2} - aujourd'hui : développeur`), 2);
  assert.strictEqual(experienceYears('5 ans d\'expérience en comptabilité'), 5);
});

test('Audio : WAV encodé puis décodé à 16 kHz', () => {
  const { encodeWav, decodeWav } = require('../../controller/ai/audio');
  const samples = Float32Array.from({ length: 16000 }, (_, i) => Math.sin(i / 10) * 0.5);
  const out = decodeWav(encodeWav(samples));
  assert.strictEqual(out.samples.length, 16000);
  assert.ok(Math.abs(out.samples[100] - samples[100]) < 0.001);
  assert.throws(() => decodeWav(Buffer.from('pas un wav du tout, vraiment pas')), /WAV/);
});

test('Recommandation selon la note globale', () => {
  const { recommendationFor } = require('../../controller/ai/evaluator');
  assert.strictEqual(recommendationFor(82), 'recommande');
  assert.strictEqual(recommendationFor(55), 'a_revoir');
  assert.strictEqual(recommendationFor(30), 'non_recommande');
});

test('Pondérations des métiers : somme = 1', () => {
  const { METIERS } = require('../../controller/ai/data/metiers');
  for (const [key, m] of Object.entries(METIERS)) {
    const sum = Object.values(m.weights).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `${key} : ${sum}`);
    assert.ok(m.quizBank.every((q) => q.correctIndex < q.options.length), `${key} : bonne réponse hors des choix`);
    assert.ok(m.interview.length >= 2, `${key} : au moins 2 questions techniques`);
  }
});

test('Communication : débit et tics de langage', () => {
  const { communicationScore } = require('../../controller/ai/answerScorer');
  const clean = communicationScore('Je conçois des API REST sécurisées avec une authentification par jeton et une validation des entrées côté serveur, puis je teste chaque route.', 12, 'voix');
  const hesitant = communicationScore('euh euh bah euh je sais pas euh du coup voilà euh', 12, 'voix');
  assert.ok(clean.score > hesitant.score);
  assert.ok(hesitant.fillers >= 5);
});
