const env = require('../../config/env');
const AppError = require('../../config/utils/AppError');
const logger = require('../../config/utils/logger');

/**
 * Client du LLM local (Ollama). Fonctions réelles : chat, appel d'outils, sortie JSON contrainte
 * par un schéma, embeddings. Garde-fous : 2 appels simultanés maximum (GPU portable),
 * délai maximal, modèles gardés en mémoire 2 h, erreurs traduites en messages clairs.
 */
const KEEP_ALIVE = '2h';
const MAX_CONCURRENT = 2;

let active = 0;
const waiting = [];

async function withSlot(fn) {
  if (active >= MAX_CONCURRENT) await new Promise((resolve) => waiting.push(resolve));
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    const next = waiting.shift();
    if (next) next();
  }
}

async function request(path, { method = 'POST', body, timeoutMs = 90000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.ollama.host}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 404 && /model/i.test(text)) {
        throw new AppError(`Modèle IA introuvable (${body?.model}). Installez-le avec : ollama pull ${body?.model}`, 503, 'LLM_MODEL_MISSING');
      }
      logger.error(`Ollama ${path} -> ${res.status} ${text.slice(0, 200)}`);
      throw new AppError(`Le service IA a renvoyé une erreur (${res.status}).`, 502, 'LLM_ERROR');
    }
    return await res.json();
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.name === 'AbortError') {
      throw new AppError('Le service IA met trop de temps à répondre (modèle en cours de chargement ?). Réessayez dans un instant.', 504, 'LLM_TIMEOUT');
    }
    if (err.cause?.code === 'ECONNREFUSED' || /fetch failed/i.test(err.message)) {
      throw new AppError('Le service IA (Ollama) n\'est pas démarré. Lancez Ollama puis réessayez.', 503, 'LLM_UNAVAILABLE');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function chat({ messages, tools, format, temperature = 0.2, numPredict = 600, timeoutMs = 90000 }) {
  if (env.aiOffline) throw new AppError('IA générative désactivée (AI_OFFLINE=1).', 503, 'LLM_UNAVAILABLE');
  return withSlot(async () => {
    const data = await request('/api/chat', {
      timeoutMs,
      body: {
        model: env.ollama.model,
        messages,
        tools: tools?.length ? tools : undefined,
        format,
        stream: false,
        keep_alive: KEEP_ALIVE,
        options: { temperature, num_predict: numPredict, num_ctx: 4096 },
      },
    });
    return {
      message: data.message || { role: 'assistant', content: '' },
      model: data.model,
      durationMs: Math.round((data.total_duration || 0) / 1e6),
    };
  });
}

/**
 * Sortie JSON contrainte par un schéma (format Ollama), puis validée par Joi.
 * En cas de réponse non conforme, une seconde tentative indique l'erreur au modèle.
 */
async function chatJson({ messages, schema, validator, temperature = 0.1, numPredict = 700, timeoutMs }) {
  let attemptMessages = messages;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { message, model, durationMs } = await chat({ messages: attemptMessages, format: schema, temperature, numPredict, timeoutMs });
    try {
      const parsed = JSON.parse(message.content);
      const { value, error } = validator.validate(parsed, { stripUnknown: true });
      if (error) throw error;
      return { data: value, model, durationMs };
    } catch (err) {
      lastError = err;
      attemptMessages = [
        ...messages,
        { role: 'assistant', content: message.content },
        { role: 'user', content: `Ta réponse n'est pas valide (${err.message}). Réponds uniquement avec un JSON conforme au schéma.` },
      ];
    }
  }
  logger.error(`Sortie JSON du LLM invalide : ${lastError?.message}`);
  throw new AppError('L\'IA a renvoyé une réponse inexploitable. Réessayez.', 502, 'LLM_BAD_OUTPUT');
}

/**
 * nomic-embed-text a un vocabulaire BERT « uncased » (minuscules, sans accents), mais le tokenizer
 * d'Ollama 0.15 n'applique pas cette normalisation : tout mot avec une majuscule devenait [UNK] et
 * « Data Science » / « Job Day Tunis » recevaient exactement le même vecteur (cosinus = 1,000).
 * On applique donc nous-mêmes la normalisation attendue par le modèle.
 */
const normalizeForEmbedding = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function embed(texts, { timeoutMs = 120000 } = {}) {
  if (!texts.length) return [];
  return withSlot(async () => {
    const data = await request('/api/embed', {
      timeoutMs,
      body: { model: env.ollama.embedModel, input: texts.map(normalizeForEmbedding), keep_alive: KEEP_ALIVE },
    });
    return data.embeddings;
  });
}

async function status() {
  try {
    const [tags, ps] = await Promise.all([
      request('/api/tags', { method: 'GET', timeoutMs: 3000 }),
      request('/api/ps', { method: 'GET', timeoutMs: 3000 }),
    ]);
    const names = (tags.models || []).map((m) => m.name);
    const has = (model) => names.some((n) => n === model || n === `${model}:latest`);
    const loaded = (ps.models || []).map((m) => m.name);
    return {
      reachable: true,
      chatModel: env.ollama.model,
      embedModel: env.ollama.embedModel,
      chatModelInstalled: has(env.ollama.model),
      embedModelInstalled: has(env.ollama.embedModel),
      loaded,
      ready: loaded.some((n) => n.startsWith(env.ollama.model.split(':')[0])),
    };
  } catch (err) {
    return { reachable: false, chatModel: env.ollama.model, embedModel: env.ollama.embedModel, error: err.message };
  }
}

// Charge les deux modèles en mémoire GPU au démarrage (le premier chargement peut prendre plusieurs minutes).
async function warmUp() {
  const started = Date.now();
  try {
    await embed(['search_query: préchauffage'], { timeoutMs: 600000 });
    await chat({ messages: [{ role: 'user', content: 'Réponds OK.' }], numPredict: 2, timeoutMs: 600000 });
    logger.info(`Modèles IA prêts (${env.ollama.model}, ${env.ollama.embedModel}) en ${Math.round((Date.now() - started) / 1000)} s`);
    return true;
  } catch (err) {
    logger.warn(`IA indisponible au démarrage : ${err.message}`);
    return false;
  }
}

module.exports = { chat, chatJson, embed, status, warmUp };
