/**
 * RÉSULTAT FINAL de l'entretien : combinaison pondérée PAR MÉTIER (controller/ai/data/metiers.js → weights) de
 *  - quiz           : pourcentage obtenu au quiz de compétences ;
 *  - technique      : moyenne des notes des questions techniques ;
 *  - communication  : moyenne des sous-notes de communication de toutes les réponses (débit, clarté, tics, longueur) ;
 *  - motivation     : moyenne présentation + motivation + situation.
 * Recommandation : ≥ 70 recommandé, 50-69 à revoir, < 50 non recommandé — décision finale par le recruteur.
 * Synthèse rédigée par le LLM à partir des SEULES données mesurées (notes, attendus couverts / manqués) ; sinon gabarit.
 */
const Joi = require('joi');
const llm = require('./ollamaClient');
const logger = require('../../config/utils/logger');
const { METIERS, metierLabel } = require('./data/metiers');

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const summaryValidator = Joi.object({
  summary: Joi.string().max(900).required(),
  strengths: Joi.array().items(Joi.string().max(200)).max(4).default([]),
  improvements: Joi.array().items(Joi.string().max(200)).max(4).default([]),
});
const summarySchema = {
  type: 'object',
  properties: { summary: { type: 'string' }, strengths: { type: 'array', items: { type: 'string' } }, improvements: { type: 'array', items: { type: 'string' } } },
  required: ['summary', 'strengths', 'improvements'],
};

function recommendationFor(overall) {
  if (overall >= 70) return 'recommande';
  if (overall >= 50) return 'a_revoir';
  return 'non_recommande';
}

async function evaluate({ interview, quizPercent, useLlm = true }) {
  const weights = METIERS[interview.metier].weights;
  const byIndex = new Map(interview.answers.map((a) => [a.questionIndex, a]));
  const scoreOf = (i) => byIndex.get(i)?.score ?? 0; // question sans réponse = 0
  const tech = [];
  const soft = [];
  interview.questions.forEach((q, i) => (q.type === 'technique' ? tech : soft).push(scoreOf(i)));
  const comms = interview.questions.map((q, i) => byIndex.get(i)?.scores?.communication ?? 0);

  const parts = {
    quiz: quizPercent ?? 0,
    technical: Math.round(mean(tech) ?? 0),
    communication: Math.round(mean(comms) ?? 0),
    motivation: Math.round(mean(soft) ?? 0),
  };
  const overall = Math.round(weights.quiz * parts.quiz + weights.technical * parts.technical
    + weights.communication * parts.communication + weights.motivation * parts.motivation);
  const recommendation = recommendationFor(overall);

  const facts = interview.questions.map((q, i) => {
    const a = byIndex.get(i);
    return `Q${i + 1} [${q.type}, ${q.skill}] « ${q.text} » note ${a?.score ?? 0}/100 ; couverts : ${(a?.coveredPoints || []).join(' | ') || 'aucun'} ; `
      + `manqués : ${(a?.missedPoints || q.keyPoints).join(' | ')} ; extrait : « ${(a?.transcript || 'pas de réponse').slice(0, 220)} »`;
  }).join('\n');

  let text = null;
  let llmUsed = false;
  if (useLlm) {
    try {
      const { data } = await llm.chatJson({
        schema: summarySchema,
        validator: summaryValidator,
        timeoutMs: 60000,
        numPredict: 450,
        messages: [
          {
            role: 'system',
            content: 'Tu rédiges, pour un recruteur, la synthèse factuelle d\'un entretien vidéo de 5 minutes. N\'utilise QUE les données fournies '
              + '(notes, attendus couverts ou manqués, extraits des réponses), sans rien inventer ni rappeler la durée. Désigne la personne par '
              + '« la personne candidate » (jamais il ou elle). JSON : summary (3 phrases en français : niveau global, ce qui est solide, ce qui manque), '
              + 'strengths (2-3 points forts concrets tirés des réponses), improvements (2-3 axes de progrès concrets).',
          },
          { role: 'user', content: `Poste : ${interview.title} (${metierLabel(interview.metier)})\nQuiz : ${parts.quiz}/100\nNote globale : ${overall}/100\n${facts}` },
        ],
      });
      text = data;
      llmUsed = true;
    } catch (err) {
      logger.warn(`Synthèse LLM indisponible (${err.code || err.message}) : synthèse par gabarit.`);
    }
  }
  if (!text) {
    const allCovered = interview.answers.flatMap((a) => a.coveredPoints || []);
    const allMissed = interview.answers.flatMap((a) => a.missedPoints || []);
    text = {
      summary: `Note globale ${overall}/100 (quiz ${parts.quiz}, technique ${parts.technical}, communication ${parts.communication}, motivation ${parts.motivation}). `
        + `${interview.answers.length}/${interview.questions.length} questions ont reçu une réponse.`,
      strengths: allCovered.slice(0, 3),
      improvements: allMissed.slice(0, 3),
    };
  }

  return {
    overall,
    ...parts,
    weights,
    recommendation,
    summary: text.summary,
    strengths: text.strengths,
    improvements: text.improvements,
    method: `pondération métier ${JSON.stringify(weights)} ; synthèse ${llmUsed ? 'LLM' : 'gabarit'}`,
    evaluatedAt: new Date(),
  };
}

module.exports = { evaluate, recommendationFor };
