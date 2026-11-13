/**
 * CHATBOT du candidat : agent RAG avec appel d'outils (boucle ReAct sur llama3.1:8b local).
 *
 *  1. Recherche HYBRIDE dans la base de connaissances (parcours, quiz, entretien, conseils par métier, FAQ) :
 *     BM25 (mots) + embeddings MiniLM multilingues (sens), fusion par rangs réciproques (RRF, k = 60).
 *     Les 4 meilleurs passages sont fournis au modèle comme contexte cité [n].
 *  2. Le modèle DÉCIDE d'appeler des outils sur les données réelles du candidat :
 *       mes_candidatures, mon_entretien, mon_quiz, offres_ouvertes, question_entrainement, evaluer_reponse.
 *     Jusqu'à 4 tours outil → observation → réponse. La trace (outils, arguments, durée) est renvoyée.
 *  3. Mode entraînement : l'agent pose une vraie question d'entretien du métier puis note la réponse avec le
 *     même correcteur que l'entretien (grille sémantique + juge LLM).
 *  Sans LLM (Ollama arrêté) : réponse extractive à partir des passages trouvés, signalée comme telle.
 */
const llm = require('./ollamaClient');
const hf = require('./hfModels');
const scorer = require('./answerScorer');
const logger = require('../../config/utils/logger');
const { METIERS, COMMON, metierLabel } = require('./data/metiers');
const Application = require('../../models/Application');
const Interview = require('../../models/Interview');
const QuizAttempt = require('../../models/QuizAttempt');
const Job = require('../../models/Job');

// ---------- Base de connaissances ----------
const STATUS_LABELS = {
  soumise: 'déposée', refusee: 'non retenue après analyse du CV', invitee: 'invité·e : quiz à passer', quiz_termine: 'quiz passé : entretien vidéo à passer',
  entretien_termine: 'entretien passé : décision du recruteur en attente', retenue: 'retenue', non_retenue: 'non retenue après entretien', retiree: 'retirée',
};

function buildDocs() {
  const docs = [
    { title: 'Comment fonctionne TalentWave Live', text: 'Tout commence quand vous cliquez sur « Postuler » sur une offre et déposez votre CV en PDF. L\'IA compare aussitôt votre CV au poste (compétences, proximité du parcours, expérience, langues) et calcule un score sur 100 expliqué. Si le score atteint le seuil de l\'offre, vous recevez un e-mail d\'acceptation pour entretien avec un lien vers le quiz, la salle d\'entretien et un lien de visioconférence (Google Meet ou Jitsi). Sinon, un e-mail explique ce qui manque.' },
    { title: 'Le quiz de compétences', text: 'Le quiz se passe avant l\'entretien vidéo. Il est chronométré (en général 8 à 10 minutes), contient des questions à choix multiples sur les compétences exigées par l\'offre et n\'autorise qu\'une tentative. Une réponse non cochée compte comme fausse. À la fin, vous voyez la correction et votre score par compétence. Les compétences les plus faibles seront approfondies par l\'avatar pendant l\'entretien.' },
    { title: 'L\'entretien vidéo avec l\'avatar', text: 'L\'entretien dure 5 minutes. Un avatar IA pose 5 questions à voix haute : présentation, deux questions techniques, une situation vécue et la motivation. Après chaque question, un court décompte vous laisse un instant, puis vous répondez à voix haute (environ 45 à 60 secondes par question). Vous pouvez répondre en français ou en anglais : la reconnaissance vocale (Whisper) détecte la langue. Vous pouvez cliquer sur « J\'ai terminé » pour passer à la suite. Si le micro ne fonctionne pas, une réponse écrite est possible.' },
    { title: 'Matériel et conditions pour l\'entretien', text: 'Utilisez Chrome ou Edge sur ordinateur, autorisez la caméra et le micro, installez-vous dans un endroit calme et bien éclairé, avec une connexion stable. Testez votre micro sur la page de la salle avant de commencer. Gardez un verre d\'eau à portée de main.' },
    { title: 'Comment l\'entretien est noté', text: 'Chaque réponse est transcrite puis comparée à une grille d\'attendus propre à la question (similarité sémantique multilingue) et évaluée par un modèle de langage selon cette grille. La communication est mesurée (débit, clarté, longueur, tics de langage). La note finale combine le quiz, la technique, la communication et la motivation avec des poids qui dépendent du métier. Le recruteur prend toujours la décision finale et vous écrit.' },
    { title: 'Méthode STAR pour les questions de situation', text: 'Pour raconter une situation vécue, utilisez la méthode STAR : Situation (le contexte), Tâche (votre objectif), Action (ce que VOUS avez fait concrètement), Résultat (le résultat chiffré si possible) et ce que vous en avez appris. Restez concret et bref : une minute suffit.' },
    { title: 'Réussir sa présentation', text: 'En 45 secondes : votre formation, une ou deux expériences ou projets marquants, vos compétences principales et pourquoi ce poste vous intéresse. Évitez de réciter le CV, faites le lien avec l\'offre.' },
    { title: 'Mot de passe oublié et compte', text: 'Sur la page de connexion, cliquez sur « Mot de passe oublié », saisissez votre e-mail : un lien valable 15 minutes vous est envoyé. Le lien ne fonctionne qu\'une fois. Vous pouvez modifier vos informations et votre langue préférée dans votre profil.' },
    { title: 'Visioconférence Google Meet', text: 'Le lien Meet (ou Jitsi) de l\'e-mail d\'invitation permet d\'échanger avec le recruteur au créneau proposé. L\'entretien noté se passe dans la salle de la plateforme avec l\'avatar ; il reste accessible jusqu\'à la date limite indiquée dans l\'e-mail.' },
    { title: 'Résultats et décision', text: 'Après l\'entretien, l\'analyse prend environ une minute. Vous verrez vos notes et des conseils par question une fois l\'évaluation terminée. Le recruteur valide ou non la candidature et vous recevez un e-mail avec sa décision.' },
  ];
  for (const [key, m] of Object.entries(METIERS)) {
    docs.push({
      title: `Préparer l'entretien — ${m.label.fr}`,
      text: `Pour le métier ${m.label.fr}, les compétences évaluées sont : ${m.skills.map((s) => s.name).join(', ')}. Questions techniques fréquentes : ${m.interview.map((i) => `« ${i.fr} » (attendus : ${i.keyPoints.join(' ; ')})`).join(' ')}`,
      metier: key,
    });
  }
  return docs.map((d, i) => ({ ...d, id: i + 1 }));
}

const DOCS = buildDocs();
const tokenize = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{2,}/g) || [];
const STOP = new Set('le la les de des du un une et en est pour que qui dans sur au aux par avec ce ces mon ma mes vous votre vos je il elle on ne pas plus comment quoi quel quelle the a an of to is and in how what my'.split(' '));
const docTokens = DOCS.map((d) => tokenize(`${d.title} ${d.text}`).filter((w) => !STOP.has(w)));
const avgLen = docTokens.reduce((a, t) => a + t.length, 0) / docTokens.length;
const df = new Map();
docTokens.forEach((toks) => new Set(toks).forEach((w) => df.set(w, (df.get(w) || 0) + 1)));

function bm25(query) {
  const q = tokenize(query).filter((w) => !STOP.has(w));
  return docTokens.map((toks, i) => {
    let s = 0;
    for (const w of q) {
      const f = toks.filter((t) => t === w).length;
      if (!f) continue;
      const idf = Math.log(1 + (DOCS.length - df.get(w) + 0.5) / (df.get(w) + 0.5));
      s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (toks.length / avgLen))));
    }
    return { i, s };
  });
}

let docVectors = null;
async function retrieve(query, k = 4) {
  const lexical = bm25(query).sort((a, b) => b.s - a.s);
  let semantic = [];
  if (!docVectors) docVectors = await hf.embed(DOCS.map((d) => `${d.title}. ${d.text}`.slice(0, 1200)));
  const qv = docVectors ? (await hf.embed([query]))?.[0] : null;
  if (qv) semantic = docVectors.map((v, i) => ({ i, s: hf.cosine(qv, v) })).sort((a, b) => b.s - a.s);
  const rrf = new Map();
  lexical.forEach((r, rank) => { if (r.s > 0) rrf.set(r.i, (rrf.get(r.i) || 0) + 1 / (60 + rank)); });
  semantic.forEach((r, rank) => rrf.set(r.i, (rrf.get(r.i) || 0) + 1 / (60 + rank)));
  return [...rrf.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([i, score]) => ({
    ...DOCS[i], score: Math.round(score * 10000) / 10000, semantic: semantic.find((s) => s.i === i)?.s ?? null,
  }));
}

// ---------- Outils (données réelles du candidat) ----------
const TOOLS = [
  { name: 'mes_candidatures', description: 'Liste les candidatures du candidat avec leur statut, score de matching et étape suivante.', parameters: { type: 'object', properties: {} } },
  { name: 'mon_entretien', description: 'Détails du prochain entretien vidéo du candidat : créneau, date limite, lien de visioconférence, statut, résultat s\'il est évalué.', parameters: { type: 'object', properties: {} } },
  { name: 'mon_quiz', description: 'Résultat du dernier quiz passé : score, réussite, compétences fortes et faibles.', parameters: { type: 'object', properties: {} } },
  { name: 'offres_ouvertes', description: 'Recherche des offres d\'emploi publiées par mot-clé.', parameters: { type: 'object', properties: { recherche: { type: 'string', description: 'mot-clé, ex. data, react' } } } },
  { name: 'question_entrainement', description: 'Donne une vraie question d\'entretien pour s\'entraîner, pour un métier.', parameters: { type: 'object', properties: { metier: { type: 'string', enum: Object.keys(METIERS) } }, required: ['metier'] } },
  { name: 'evaluer_reponse', description: 'Note une réponse d\'entraînement du candidat à une question d\'entretien donnée précédemment.', parameters: { type: 'object', properties: { question: { type: 'string' }, reponse: { type: 'string' } }, required: ['question', 'reponse'] } },
];

function practiceQuestion(metier) {
  const m = METIERS[metier] || METIERS['dev-fullstack'];
  const pool = [...m.interview, COMMON.situation, COMMON.presentation];
  const q = pool[Math.floor(Math.random() * pool.length)];
  return { metier: m.label.fr, type: q.type, question: q.fr, competence: q.skill };
}

function findBankQuestion(text) {
  const all = [...Object.values(METIERS).flatMap((m) => m.interview), ...Object.values(COMMON)];
  const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return all.find((q) => norm(q.fr) === norm(text) || norm(q.en) === norm(text)) || null;
}

async function evaluatePractice(questionText, answerText, { useLlm = false } = {}) {
  const bank = findBankQuestion(questionText);
  const question = bank ? { text: bank.fr, type: bank.type, keyPoints: bank.keyPoints } : { text: questionText, type: 'technique', keyPoints: ['réponse structurée', 'exemple concret', 'lien avec le poste'] };
  const s = await scorer.scoreAnswer(question, { transcript: answerText, inputMode: 'texte' }, { useLlm });
  return { note: s.score, points_couverts: s.coveredPoints, points_a_developper: s.missedPoints, conseil: s.feedback, methode: s.method };
}

async function runTool(name, args, user) {
  switch (name) {
    case 'mes_candidatures': {
      const apps = await Application.find({ candidate: user._id }).populate('job', 'title').sort('-createdAt').limit(10);
      return apps.map((a) => ({ offre: a.job?.title, statut: STATUS_LABELS[a.status] || a.status, score_matching: a.matching?.score, deposee_le: a.createdAt.toISOString().slice(0, 10) }));
    }
    case 'mon_entretien': {
      const itv = await Interview.findOne({ candidate: user._id, status: { $in: ['planifie', 'en_cours', 'termine', 'evalue'] } }).sort('-createdAt').populate('job', 'title');
      if (!itv) return { info: 'Aucun entretien prévu pour le moment.' };
      return {
        poste: itv.job?.title, statut: itv.status, creneau: itv.scheduledAt, date_limite: itv.expiresAt, visio: itv.meet?.link, langue: itv.language,
        note_globale: itv.status === 'evalue' ? itv.evaluation?.overall : undefined, salle: `/entretien/${itv._id}`,
      };
    }
    case 'mon_quiz': {
      const at = await QuizAttempt.findOne({ candidate: user._id, status: { $ne: 'en_cours' } }).sort('-createdAt');
      if (!at) return { info: 'Aucun quiz passé pour le moment.' };
      const sorted = [...at.perSkill].sort((a, b) => a.percent - b.percent);
      return { score: at.percent, reussi: at.passed, competences_faibles: sorted.slice(0, 2).map((s) => `${s.skill} (${s.percent} %)`), competences_fortes: sorted.slice(-2).map((s) => `${s.skill} (${s.percent} %)`) };
    }
    case 'offres_ouvertes': {
      const re = args.recherche ? new RegExp(String(args.recherche).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 40), 'i') : null;
      const jobs = await Job.find({ status: 'publiee', ...(re ? { $or: [{ title: re }, { requiredSkills: re }, { description: re }] } : {}) }).limit(5).select('title location contractType metier');
      return jobs.map((j) => ({ titre: j.title, lieu: j.location, contrat: j.contractType, metier: metierLabel(j.metier), lien: `/offres/${j._id}` }));
    }
    case 'question_entrainement':
      return practiceQuestion(args.metier);
    case 'evaluer_reponse':
      return evaluatePractice(String(args.question || ''), String(args.reponse || ''));
    default:
      return { erreur: `Outil inconnu : ${name}` };
  }
}

// ---------- Agent ----------
const SYSTEM = `Tu es « Nora », l'assistante de recrutement de TalentWave Live. Tu aides le candidat : fonctionnement de la plateforme,
préparation du quiz et de l'entretien vidéo de 5 minutes avec l'avatar, suivi de ses candidatures, entraînement aux questions d'entretien.
Règles : réponds dans la langue du candidat (français par défaut), en 2 à 6 phrases claires, en le vouvoyant.
Appuie-toi sur les PASSAGES fournis (cite [n]) et, pour toute donnée personnelle (candidatures, quiz, entretien, offres), APPELLE L'OUTIL adapté :
n'invente jamais un statut, une date ou un score. Pour un entraînement : appelle question_entrainement, pose la question et attends la réponse ;
quand le candidat répond, appelle evaluer_reponse avec la question et sa réponse, puis donne la note et des conseils.
Ne donne jamais les réponses du quiz.`;

async function chat({ user, message, history = [] }) {
  const started = Date.now();
  const passages = await retrieve(message);
  const context = passages.map((p, i) => `[${i + 1}] ${p.title} : ${p.text}`).join('\n');
  const trace = [];
  const messages = [
    { role: 'system', content: `${SYSTEM}\n\nPASSAGES :\n${context}\n\nCandidat : ${user.firstName} ${user.lastName}.` },
    ...history.slice(-8).map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content).slice(0, 1500) })),
    { role: 'user', content: message },
  ];

  try {
    for (let step = 0; step < 4; step += 1) {
      const { message: reply, model } = await llm.chat({ messages, tools: TOOLS.map((t) => ({ type: 'function', function: t })), temperature: 0.3, numPredict: 500, timeoutMs: 90000 });
      const calls = reply.tool_calls || [];
      if (!calls.length) {
        return { answer: reply.content.trim(), sources: passages.map((p, i) => ({ n: i + 1, title: p.title, score: p.score })), tools: trace, mode: 'agent', model, durationMs: Date.now() - started };
      }
      messages.push(reply);
      for (const call of calls) {
        const name = call.function?.name;
        const args = typeof call.function?.arguments === 'string' ? JSON.parse(call.function.arguments || '{}') : (call.function?.arguments || {});
        const t0 = Date.now();
        const result = await runTool(name, args, user);
        trace.push({ tool: name, args, ms: Date.now() - t0 });
        messages.push({ role: 'tool', content: JSON.stringify(result).slice(0, 3000) });
      }
    }
    const { message: last, model } = await llm.chat({ messages, temperature: 0.3, numPredict: 400 });
    return { answer: last.content.trim(), sources: passages.map((p, i) => ({ n: i + 1, title: p.title, score: p.score })), tools: trace, mode: 'agent', model, durationMs: Date.now() - started };
  } catch (err) {
    logger.warn(`Chatbot en mode extractif (${err.code || err.message})`);
    const best = passages[0];
    return {
      answer: best ? `${best.text}\n\n(Assistant en mode simplifié : l'IA générative est momentanément indisponible.)` : 'Je n\'ai pas trouvé d\'information à ce sujet.',
      sources: passages.map((p, i) => ({ n: i + 1, title: p.title, score: p.score })),
      tools: trace,
      mode: 'extractif',
      durationMs: Date.now() - started,
    };
  }
}

module.exports = { chat, retrieve, practiceQuestion, evaluatePractice, runTool, DOCS, TOOLS };
