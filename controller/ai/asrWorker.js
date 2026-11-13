/**
 * Thread dédié à Whisper (worker_threads) : la transcription (plusieurs secondes de calcul) ne bloque jamais
 * la boucle d'événements de l'API — les autres candidats et les autres requêtes restent servis.
 *
 * Pour chaque réponse orale :
 *  1. DÉTECTION DE LANGUE par Whisper lui-même : un pas de décodage après <|startoftranscript|> sur les 30 premières
 *     secondes ; on compare les logits des jetons <|fr|> et <|en|> (langues de l'entretien). Sans cela, la version
 *     JavaScript de Whisper suppose l'anglais et TRADUIT une réponse française (constaté en test).
 *  2. TRANSCRIPTION dans la langue détectée.
 */
const { parentPort, workerData } = require('worker_threads');

let pipe;
let T;

async function load() {
  T = await import('@huggingface/transformers');
  T.env.cacheDir = workerData.cacheDir;
  T.env.allowLocalModels = true;
  pipe = await T.pipeline('automatic-speech-recognition', workerData.modelId, { dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' } });
}

async function detectLanguage(samples, allowed) {
  const feats = await pipe.processor(samples.subarray(0, 16000 * 30));
  const gc = pipe.model.generation_config;
  const out = await pipe.model({
    input_features: feats.input_features,
    decoder_input_ids: new T.Tensor('int64', BigInt64Array.from([BigInt(gc.decoder_start_token_id)]), [1, 1]),
  });
  const vocab = out.logits.dims.at(-1);
  const last = out.logits.data.subarray(out.logits.data.length - vocab);
  const logits = allowed.map((code) => ({ code, logit: last[gc.lang_to_id[`<|${code}|>`]] }));
  const max = Math.max(...logits.map((l) => l.logit));
  const exp = logits.map((l) => Math.exp(l.logit - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  const probs = Object.fromEntries(logits.map((l, i) => [l.code, Math.round((1000 * exp[i]) / sum) / 1000]));
  const best = logits.sort((a, b) => b.logit - a.logit)[0].code;
  return { language: best, probs };
}

const ready = load().then(() => parentPort.postMessage({ type: 'ready' })).catch((err) => parentPort.postMessage({ type: 'error', error: err.message }));

parentPort.on('message', async ({ id, samples, language, allowed = ['fr', 'en'] }) => {
  try {
    await ready;
    if (!pipe) throw new Error('Whisper non chargé');
    const t0 = Date.now();
    const detected = language ? { language, probs: null } : await detectLanguage(samples, allowed);
    const t1 = Date.now();
    const out = await pipe(samples, { language: detected.language === 'fr' ? 'french' : 'english', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
    parentPort.postMessage({ id, ok: true, text: String(out.text || '').trim(), language: detected.language, probs: detected.probs, detectMs: t1 - t0, transcribeMs: Date.now() - t1 });
  } catch (err) {
    parentPort.postMessage({ id, ok: false, error: err.message });
  }
});
