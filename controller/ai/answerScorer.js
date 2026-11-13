/**
 * NOTATION d'une réponse d'entretien (orale transcrite par Whisper, ou écrite) — mécanisme hybride et explicable :
 *
 *  1. Couverture de la grille (sémantique) : la réponse est découpée en phrases ET en fenêtres glissantes de 14 mots ;
 *     chaque attendu de la grille (keyPoints) est comparé à tous ces segments (MiniLM multilingue, cosinus).
 *     Attendu « couvert » si la meilleure similarité ≥ 0,45 (calibré : bonne réponse 0,5-0,8, hors sujet < 0,1) ; score continu = moyenne des similarités recalées.
 *     Multilingue : une réponse en anglais est notée directement contre une grille en français.
 *  2. Pertinence : similarité entre la question et la réponse entière (hors-sujet détecté).
 *  3. Communication : longueur utile, débit (mots/minute à l'oral, idéal 100-170), tics de langage (euh, hum, like…),
 *     répétitions.
 *  4. Juge LLM (llama3.1:8b local, sortie JSON contrainte) : note /10 selon la même grille + retour au candidat.
 *     Fusion : technique = 45 % couverture + 15 % pertinence + 40 % LLM ; sans LLM : 75 % / 25 % (signalé).
 */
const Joi = require('joi');
const hf = require('./hfModels');
const llm = require('./ollamaClient');
const logger = require('../../config/utils/logger');
const { sentences, windows, wordCount, clamp01, round } = require('./textUtils');

const COVER_THRESHOLD = 0.45;
const WORDS_PER_POINT = 7;
const FILLERS = /(?<![\p{L}])(euh+|heu+|hum+|bah|ben|genre|voilà|du coup|en fait|um+|uh+|erm|like|you know|i mean)(?![\p{L}])/giu;

function communicationScore(transcript, durationSec, inputMode) {
  const words = wordCount(transcript);
  const fillers = (transcript.match(FILLERS) || []).length;
  const fillerRatio = words ? fillers / words : 0;
  const tokens = transcript.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const repetition = tokens.length ? 1 - new Set(tokens).size / tokens.length : 0;
  const length = clamp01(words / 70);
  let pace = 1;
  let wpm = null;
  if (inputMode === 'voix' && durationSec > 3) {
    wpm = Math.round(words / (durationSec / 60));
    pace = wpm < 60 ? clamp01(wpm / 60) * 0.7 : wpm > 200 ? clamp01(1 - (wpm - 200) / 120) : wpm < 100 ? 0.85 : 1;
  }
  const score = clamp01(0.45 * length + 0.3 * pace + 0.25 * clamp01(1 - fillerRatio * 6) - Math.max(0, repetition - 0.45));
  return { score, wpm, fillers, words };
}

const judgeValidator = Joi.object({
  score: Joi.number().min(0).max(10).required(),
  covered: Joi.array().items(Joi.string()).default([]),
  feedback: Joi.string().max(600).required(),
});
const judgeSchema = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    covered: { type: 'array', items: { type: 'string' } },
    feedback: { type: 'string' },
  },
  required: ['score', 'covered', 'feedback'],
};

async function llmJudge(question, transcript, metierLabel) {
  const { data } = await llm.chatJson({
    schema: judgeSchema,
    validator: judgeValidator,
    timeoutMs: 45000,
    numPredict: 300,
    messages: [
      {
        role: 'system',
        content: `Tu es recruteur expert (${metierLabel}). Tu notes la réponse orale d'un candidat (transcription automatique, `
          + 'ignorer les fautes de transcription) selon la grille d\'attendus fournie. Sois juste et exigeant : une réponse vague ou '
          + 'hors sujet a une note faible ; ne pas inventer ce que le candidat n\'a pas dit. Réponds en JSON : score (0-10), '
          + 'covered (attendus de la grille réellement abordés, recopiés tels quels), feedback (2 phrases en français, adressées au candidat, '
          + 'en le vouvoyant : un point fort puis un conseil concret).',
      },
      {
        role: 'user',
        content: `Question : ${question.text}\nGrille d'attendus :\n${question.keyPoints.map((k) => `- ${k}`).join('\n')}\n\nRéponse du candidat :\n"""${transcript.slice(0, 2500)}"""`,
      },
    ],
  });
  return data;
}

/**
 * question : { text, type, keyPoints[] } ; answer : { transcript, durationSec, inputMode } ; metierLabel pour le juge.
 * Renvoie { score 0-100, scores {relevance, coverage, communication, llm}, coveredPoints, missedPoints, feedback, wordsPerMinute, method }.
 */
async function scoreAnswer(question, { transcript, durationSec = 0, inputMode = 'texte' }, { metierLabel = '', useLlm = true } = {}) {
  const text = String(transcript || '').trim();
  const words = wordCount(text);
  if (words < 4) {
    return {
      score: 0,
      scores: { relevance: 0, coverage: 0, communication: 0, llm: null },
      coveredPoints: [],
      missedPoints: question.keyPoints,
      feedback: 'Aucune réponse exploitable n\'a été détectée pour cette question.',
      wordsPerMinute: null,
      method: 'réponse vide',
    };
  }

  const segments = [...new Set([...sentences(text, { min: 3, max: 40 }), ...windows(text, 14, 7)])];
  const vectors = await hf.embed([question.text, text.slice(0, 1500), ...question.keyPoints, ...segments]);

  let coverage = null;
  let relevance = null;
  const coveredPoints = [];
  const missedPoints = [];
  if (vectors) {
    const [qv, av] = vectors;
    const kpv = vectors.slice(2, 2 + question.keyPoints.length);
    const segv = vectors.slice(2 + question.keyPoints.length);
    const sims = kpv.map((k) => Math.max(...segv.map((s) => hf.cosine(k, s))));
    // Densité : on ne développe pas N attendus en quelques mots. Au-delà de la capacité de la réponse
    // (≈ 7 mots par attendu), seuls les attendus les plus proches sont comptés comme couverts.
    const density = clamp01(words / (WORDS_PER_POINT * question.keyPoints.length));
    const capacity = Math.max(1, Math.round(density * question.keyPoints.length));
    const ranked = sims.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
    const coveredIdx = new Set(ranked.filter((r) => r.s >= COVER_THRESHOLD).slice(0, capacity).map((r) => r.i));
    sims.forEach((s, i) => (coveredIdx.has(i) ? coveredPoints : missedPoints).push(question.keyPoints[i]));
    coverage = density * (sims.reduce((a, s) => a + clamp01((s - 0.2) / 0.4), 0) / sims.length);
    relevance = clamp01((hf.cosine(qv, av) - 0.15) / 0.45);
  }

  const comm = communicationScore(text, durationSec, inputMode);

  let judge = null;
  if (useLlm) {
    try {
      judge = await llmJudge(question, text, metierLabel);
    } catch (err) {
      logger.warn(`Juge LLM indisponible (${err.code || err.message}) : notation par embeddings seule.`);
    }
  }

  let technical;
  let method;
  if (coverage !== null && judge) {
    technical = 0.45 * coverage + 0.15 * relevance + 0.4 * (judge.score / 10);
    method = 'grille sémantique (MiniLM) + juge LLM (llama3.1)';
  } else if (coverage !== null) {
    technical = 0.75 * coverage + 0.25 * relevance;
    method = 'grille sémantique (MiniLM) seule';
  } else if (judge) {
    technical = judge.score / 10;
    method = 'juge LLM seul (embeddings indisponibles)';
  } else {
    technical = clamp01(words / 80) * 0.5;
    method = 'longueur seule (modèles indisponibles)';
  }

  // Les points couverts selon le juge complètent ceux de la similarité (union, sans doublon).
  if (judge) {
    for (const c of judge.covered) {
      const hit = question.keyPoints.find((k) => k.toLowerCase() === c.toLowerCase().trim());
      if (hit && !coveredPoints.includes(hit)) {
        coveredPoints.push(hit);
        missedPoints.splice(missedPoints.indexOf(hit), 1);
      }
    }
  }

  const feedback = judge?.feedback
    || (missedPoints.length
      ? `Points bien abordés : ${coveredPoints.length}/${question.keyPoints.length}. À développer : ${missedPoints.slice(0, 2).join(' ; ')}.`
      : 'Réponse complète : tous les attendus de la grille sont abordés.');

  return {
    score: Math.round(100 * clamp01(0.85 * technical + 0.15 * comm.score)),
    scores: {
      relevance: relevance === null ? null : Math.round(relevance * 100),
      coverage: coverage === null ? null : Math.round(coverage * 100),
      communication: Math.round(comm.score * 100),
      llm: judge ? round(judge.score * 10, 0) : null,
    },
    coveredPoints,
    missedPoints,
    feedback,
    wordsPerMinute: comm.wpm,
    method,
  };
}

module.exports = { scoreAnswer, communicationScore };
