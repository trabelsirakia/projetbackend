/**
 * DÉROULÉ DE L'ENTRETIEN (5 minutes) construit pour CE candidat et CE poste :
 *
 *   1. présentation  (45 s)  question commune
 *   2. technique     (60 s)  compétence exigée par l'offre où le candidat a eu la PLUS FAIBLE note au quiz
 *   3. technique     (60 s)  question générée par le LLM sur une compétence manquante du CV ou la 2e plus faible
 *                            (grille d'attendus générée elle aussi, validée par schéma) ; banque du métier en secours
 *   4. situation     (50 s)  question comportementale commune
 *   5. motivation    (45 s)  question commune
 *  ≈ 260 s de réponses + ≈ 40 s de paroles de l'avatar = 5 minutes.
 */
const Joi = require('joi');
const llm = require('./ollamaClient');
const logger = require('../../config/utils/logger');
const { METIERS, COMMON, metierLabel } = require('./data/metiers');

const TIME = { presentation: 45, technique: 60, situation: 50, motivation: 45 };

const toQuestion = (bankQ, lang, order) => ({
  order,
  type: bankQ.type,
  skill: bankQ.skill,
  text: lang === 'en' ? bankQ.en : bankQ.fr,
  keyPoints: bankQ.keyPoints,
  timeLimitSec: TIME[bankQ.type],
  source: 'banque',
});

/** Compétences classées de la plus faible à la plus forte (quiz par compétence, puis compétences manquantes du CV). */
function weakSkills({ quizAttempt, application, job }) {
  const ranked = [];
  for (const s of [...(quizAttempt?.perSkill || [])].sort((a, b) => a.percent - b.percent)) ranked.push(s.skill);
  for (const s of application?.matching?.missingSkills || []) if (!ranked.includes(s)) ranked.push(s);
  for (const s of job.requiredSkills || []) if (!ranked.includes(s)) ranked.push(s);
  return ranked;
}

const generatedValidator = Joi.object({
  question: Joi.string().min(15).max(260).required(),
  keyPoints: Joi.array().items(Joi.string().min(3).max(160)).min(3).max(5).required(),
});
const generatedSchema = {
  type: 'object',
  properties: { question: { type: 'string' }, keyPoints: { type: 'array', items: { type: 'string' } } },
  required: ['question', 'keyPoints'],
};

async function generateQuestion({ job, skill, lang }) {
  const { data } = await llm.chatJson({
    schema: generatedSchema,
    validator: generatedValidator,
    timeoutMs: 45000,
    numPredict: 350,
    temperature: 0.5,
    messages: [
      {
        role: 'system',
        content: 'Tu prépares UNE question d\'entretien d\'embauche ORALE, lue à voix haute par un avatar : une seule phrase courte '
          + '(30 mots maximum), concrète et ouverte (« Comment… », « Que feriez-vous si… »), sur la compétence indiquée, adaptée au poste ; '
          + 'la réponse doit tenir en une minute. Fournis aussi la grille : 3 à 5 attendus courts (en français) qu\'une bonne '
          + `réponse doit contenir. La question est rédigée en ${lang === 'en' ? 'anglais' : 'français'} et vouvoie le candidat. JSON uniquement.`,
      },
      { role: 'user', content: `Poste : ${job.title} (${metierLabel(job.metier)})\nCompétence ciblée : ${skill}\nExtrait de l'offre : ${job.description.slice(0, 700)}` },
    ],
  });
  return data;
}

async function plan({ job, application, quizAttempt, language = 'fr', useLlm = true }) {
  const metier = METIERS[job.metier];
  const bank = metier.interview;
  const ranked = weakSkills({ quizAttempt, application, job });

  // Technique n°1 : question de la banque dont la compétence est la plus faible (sinon la première).
  const pick = (exclude) => {
    for (const skill of ranked) {
      const hit = bank.find((b) => b.skill.toLowerCase() === skill.toLowerCase() && !exclude.includes(b));
      if (hit) return hit;
    }
    return bank.find((b) => !exclude.includes(b));
  };
  const tech1 = pick([]);
  const questions = [toQuestion(COMMON.presentation, language, 1), toQuestion(tech1, language, 2)];

  // Technique n°2 : générée par le LLM sur la compétence faible suivante ; banque en secours.
  const target = ranked.find((s) => s.toLowerCase() !== tech1.skill.toLowerCase()) || tech1.skill;
  let tech2 = null;
  if (useLlm) {
    try {
      const g = await generateQuestion({ job, skill: target, lang: language });
      tech2 = { order: 3, type: 'technique', skill: target, text: g.question, keyPoints: g.keyPoints, timeLimitSec: TIME.technique, source: 'ia' };
    } catch (err) {
      logger.warn(`Question IA non générée (${err.code || err.message}) : question de la banque utilisée.`);
    }
  }
  questions.push(tech2 || toQuestion(pick([tech1]), language, 3));
  questions.push(toQuestion(COMMON.situation, language, 4));
  questions.push(toQuestion(COMMON.motivation, language, 5));
  return questions;
}

module.exports = { plan, weakSkills, TIME };
