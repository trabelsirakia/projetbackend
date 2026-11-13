/**
 * Modèles pré-entraînés Hugging Face exécutés LOCALEMENT (transformers.js + ONNX Runtime, quantifiés) :
 *  - embeddings de phrases multilingues : sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
 *      → job matching (CV ↔ offre), notation des réponses d'entretien (réponse ↔ attendus), recherche du chatbot ;
 *      multilingue : une réponse en anglais est comparée directement à une grille rédigée en français ;
 *  - reconnaissance vocale : OpenAI Whisper (small, multilingue) → transcription des réponses orales fr/en
 *      avec détection de la langue.
 * Téléchargement unique dans config/models-cache (npm run models), chargement unique, préchauffage au démarrage.
 */
const path = require('path');
const crypto = require('crypto');
const { Worker } = require('worker_threads');
const env = require('../../config/env');
const logger = require('../../config/utils/logger');

const CACHE_DIR = path.join(__dirname, '..', '..', 'config', 'models-cache');

const REGISTRY = {
  embeddings: {
    id: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    source: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    task: 'feature-extraction',
    options: { dtype: 'q8' },
    role: 'Similarité sémantique multilingue (matching CV ↔ offre, réponse ↔ grille, recherche du chatbot)',
    sizeMb: 118,
  },
  whisper: {
    id: env.whisperModel,
    source: env.whisperModel.replace(/^(Xenova|onnx-community)\//, 'openai/'),
    task: 'automatic-speech-recognition',
    options: { dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' } },
    role: 'Transcription des réponses orales de l\'entretien (français / anglais) et détection de la langue',
    sizeMb: 250,
  },
};

const state = Object.fromEntries(Object.keys(REGISTRY).map((k) => [k, { status: 'idle', pipe: null, promise: null, loadMs: null, error: null }]));
let transformers;

async function lib() {
  if (!transformers) {
    transformers = await import('@huggingface/transformers');
    transformers.env.cacheDir = CACHE_DIR;
    transformers.env.allowLocalModels = true;
  }
  return transformers;
}

/** Pipeline du modèle `key`, chargé une seule fois (téléchargé au premier besoin). null si indisponible. */
async function get(key) {
  if (key === 'whisper') return startWorker();
  const s = state[key];
  if (s.pipe) return s.pipe;
  if (!s.promise) {
    s.status = 'loading';
    const started = Date.now();
    s.promise = (async () => {
      const { pipeline } = await lib();
      const pipe = await pipeline(REGISTRY[key].task, REGISTRY[key].id, REGISTRY[key].options);
      s.pipe = pipe;
      s.status = 'ready';
      s.loadMs = Date.now() - started;
      s.error = null;
      logger.info(`Modèle ${REGISTRY[key].source} prêt en ${(s.loadMs / 1000).toFixed(1)} s`);
      return pipe;
    })().catch((err) => {
      s.status = 'error';
      s.error = err.message;
      s.promise = null;
      logger.warn(`Modèle ${REGISTRY[key].source} indisponible : ${err.message}`);
      return null;
    });
  }
  return s.promise;
}

// ---------- Embeddings (cache mémoire : une phrase n'est calculée qu'une fois) ----------
const cache = new Map();
const hash = (t) => crypto.createHash('sha1').update(t).digest('base64');

async function embed(texts) {
  const pipe = await get('embeddings');
  if (!pipe) return null;
  const out = new Array(texts.length);
  const missing = [];
  texts.forEach((t, i) => {
    const v = cache.get(hash(t));
    if (v) out[i] = v; else missing.push(i);
  });
  for (let b = 0; b < missing.length; b += 32) {
    const batch = missing.slice(b, b + 32);
    const tensor = await pipe(batch.map((i) => texts[i]), { pooling: 'mean', normalize: true });
    const dim = tensor.dims[1];
    batch.forEach((i, j) => {
      const v = Float32Array.from(tensor.data.subarray(j * dim, (j + 1) * dim));
      out[i] = v;
      if (cache.size >= 20000) cache.delete(cache.keys().next().value);
      cache.set(hash(texts[i]), v);
    });
  }
  return out;
}

const cosine = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
};

// ---------- Whisper (dans un thread dédié : controller/ai/asrWorker.js) ----------
let worker = null;
let seq = 0;
const waiting = new Map();

function failAll(message) {
  for (const w of waiting.values()) w.reject(new Error(message));
  waiting.clear();
}

function startWorker() {
  const s = state.whisper;
  if (s.promise) return s.promise;
  s.status = 'loading';
  const started = Date.now();
  s.promise = new Promise((resolve) => {
    worker = new Worker(path.join(__dirname, 'asrWorker.js'), { workerData: { cacheDir: CACHE_DIR, modelId: REGISTRY.whisper.id } });
    const reset = (message) => {
      s.status = 'error';
      s.error = message;
      s.pipe = null;
      s.promise = null; // un prochain appel relancera le thread
      worker = null;
      failAll(message);
      resolve(null);
    };
    worker.on('message', (m) => {
      if (m.type === 'ready') {
        Object.assign(s, { status: 'ready', pipe: worker, loadMs: Date.now() - started, error: null });
        logger.info(`Modèle ${REGISTRY.whisper.source} prêt en ${(s.loadMs / 1000).toFixed(1)} s (thread dédié)`);
        resolve(worker);
      } else if (m.type === 'error') {
        logger.warn(`Modèle ${REGISTRY.whisper.source} indisponible : ${m.error}`);
        worker.terminate();
        reset(m.error);
      } else {
        const w = waiting.get(m.id);
        if (!w) return;
        waiting.delete(m.id);
        clearTimeout(w.timer);
        if (m.ok) w.resolve(m); else w.reject(new Error(m.error));
      }
    });
    worker.on('error', (err) => { logger.error(`Thread Whisper en erreur : ${err.message}`); reset(err.message); });
    worker.on('exit', (code) => { if (s.status !== 'error') reset(`thread Whisper arrêté (code ${code})`); });
  });
  return s.promise;
}

/**
 * Transcrit un signal mono 16 kHz (Float32Array). language : 'fr' | 'en' | null (détection par Whisper).
 * Renvoie { text, language, probs, detectMs, transcribeMs } ou null si le modèle est indisponible.
 */
async function transcribe(samples, language = null, { timeoutMs = 180000 } = {}) {
  const w = await startWorker();
  if (!w) return null;
  const id = ++seq;
  const copy = Float32Array.from(samples); // tampon propre, transféré sans recopie au thread
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error('Transcription trop longue')); }, timeoutMs);
    waiting.set(id, { resolve, reject, timer });
    w.postMessage({ id, samples: copy, language }, [copy.buffer]);
  });
}

async function shutdown() {
  if (worker) await worker.terminate();
}

/** Préchargement en arrière-plan (au démarrage du serveur). */
function warmUp() {
  for (const key of Object.keys(REGISTRY)) get(key);
}

function status() {
  return Object.entries(REGISTRY).map(([key, m]) => ({
    key, name: m.source, runtimeId: m.id, task: m.task, role: m.role, sizeMb: m.sizeMb,
    status: state[key].status, loadMs: state[key].loadMs, error: state[key].error,
  }));
}

module.exports = { get, embed, cosine, transcribe, warmUp, shutdown, status, REGISTRY };
