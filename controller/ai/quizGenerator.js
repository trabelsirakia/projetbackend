/**
 * Questions de quiz :
 *  - fromBank : tirage dans la banque du métier, en privilégiant les compétences EXIGÉES par l'offre ;
 *  - withLlm  : génération de QCM par le LLM local (sortie JSON contrainte + validation Joi), pour une liste de
 *               compétences ; contrôles automatiques : 4 réponses distinctes, index correct valide, pas de doublon
 *               avec la banque. Le quiz généré est créé « inactif » : le recruteur le relit avant de l'activer.
 */
const Joi = require('joi');
const llm = require('./ollamaClient');
const { METIERS, metierLabel } = require('./data/metiers');

function fromBank(metier, { requiredSkills = [], count = 10 } = {}) {
  const bank = METIERS[metier].quizBank;
  const wanted = requiredSkills.map((s) => s.toLowerCase());
  const priority = bank.filter((qq) => wanted.includes(qq.skill.toLowerCase()));
  const rest = bank.filter((qq) => !priority.includes(qq));
  return [...priority, ...rest].slice(0, count).map((qq) => ({ ...qq, points: qq.difficulty === 'difficile' ? 2 : 1 }));
}

const itemValidator = Joi.object({
  text: Joi.string().min(10).max(500).required(),
  options: Joi.array().items(Joi.string().min(1).max(250)).length(4).unique((a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()).required(),
  correctIndex: Joi.number().integer().min(0).max(3).required(),
  explanation: Joi.string().max(500).allow('').default(''),
  skill: Joi.string().max(60).required(),
  difficulty: Joi.string().valid('facile', 'moyen', 'difficile').default('moyen'),
});
const validator = Joi.object({ questions: Joi.array().items(itemValidator).min(1).required() });
const schema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correctIndex: { type: 'integer' },
          explanation: { type: 'string' },
          skill: { type: 'string' },
          difficulty: { type: 'string', enum: ['facile', 'moyen', 'difficile'] },
        },
        required: ['text', 'options', 'correctIndex', 'explanation', 'skill', 'difficulty'],
      },
    },
  },
  required: ['questions'],
};

async function withLlm({ metier, skills, count = 5, difficulty = 'moyen', language = 'fr' }) {
  const { data, model, durationMs } = await llm.chatJson({
    schema,
    validator,
    timeoutMs: 120000,
    numPredict: 1800,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content: `Tu es expert en recrutement (${metierLabel(metier)}). Rédige ${count} questions à choix multiples de niveau ${difficulty}, `
          + `en ${language === 'en' ? 'anglais' : 'français'}, qui testent une compétence PRATIQUE (pas de culture générale). `
          + 'Chaque question : exactement 4 réponses plausibles et distinctes, une seule correcte (correctIndex 0-3, varie sa position), '
          + 'une explication courte, la compétence testée (choisie dans la liste fournie). JSON uniquement.',
      },
      { role: 'user', content: `Compétences à tester : ${skills.join(', ')}` },
    ],
  });
  const bankTexts = new Set(METIERS[metier].quizBank.map((qq) => qq.text.toLowerCase()));
  const seen = new Set();
  const questions = data.questions
    .filter((qq) => !bankTexts.has(qq.text.toLowerCase()) && !seen.has(qq.text.toLowerCase()) && seen.add(qq.text.toLowerCase()))
    .slice(0, count)
    .map((qq) => ({ ...qq, points: qq.difficulty === 'difficile' ? 2 : 1 }));
  return { questions, model, durationMs };
}

module.exports = { fromBank, withLlm };
