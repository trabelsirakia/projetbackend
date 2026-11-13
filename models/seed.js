/**
 * npm run seed : base de démonstration (base talentwave_live par défaut).
 * Refuse d'écraser une base qui contient déjà des comptes, sauf avec --force.
 *
 * Contenu : 1 admin, 2 recruteurs, 6 candidats (adresses « + » de la boîte du projet : les e-mails arrivent vraiment),
 * 7 offres (une par métier + une offre exigeante), 1 quiz actif par métier (banque), et 4 parcours complets
 * (candidature → quiz → entretien) NOTÉS PAR LE VRAI CORRECTEUR (embeddings) à partir de réponses écrites,
 * pour que les statistiques et l'écran recruteur aient des données dès le départ.
 */
const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('./User');
const Job = require('./Job');
const Quiz = require('./Quiz');
const QuizAttempt = require('./QuizAttempt');
const Application = require('./Application');
const Interview = require('./Interview');
const { textPdf } = require('../config/utils/pdfWriter');
const matching = require('../controller/ai/matching');
const quizGenerator = require('../controller/ai/quizGenerator');
const { TIME } = require('../controller/ai/interviewPlanner');
const scorer = require('../controller/ai/answerScorer');
const evaluator = require('../controller/ai/evaluator');
const { METIERS, COMMON, metierLabel } = require('../controller/ai/data/metiers');

// Identifiants des comptes de démonstration FIXES (indépendants du Gmail d'envoi) : mêmes connexions dans les
// collections Postman, le README et les données exportées. Les e-mails suivent MAIL_REDIRECT_TO (.env).
const DEMO_BOX = (process.env.DEMO_ACCOUNTS_BOX || 'raifguizani10@gmail.com').trim();
const box = (tag) => `${DEMO_BOX.split('@')[0]}+${tag}@${DEMO_BOX.split('@')[1]}`;

const USERS = [
  { firstName: 'Admin', lastName: 'TalentWave', email: box('live-admin'), password: 'Admin@2026', role: 'admin' },
  { firstName: 'Sarra', lastName: 'Mansouri', email: box('live-rh'), password: 'Recruteur@2026', role: 'recruteur' },
  { firstName: 'Karim', lastName: 'Jaziri', email: box('live-rh2'), password: 'Recruteur@2026', role: 'recruteur' },
  { firstName: 'Amira', lastName: 'Ben Salah', email: box('live-candidat1'), password: 'Candidat@2026', role: 'candidat' },
  { firstName: 'Youssef', lastName: 'Trabelsi', email: box('live-candidat2'), password: 'Candidat@2026', role: 'candidat', preferredLanguage: 'en' },
  { firstName: 'Ines', lastName: 'Gharbi', email: box('live-candidat3'), password: 'Candidat@2026', role: 'candidat' },
  { firstName: 'Mehdi', lastName: 'Bouazizi', email: box('live-candidat4'), password: 'Candidat@2026', role: 'candidat' },
  { firstName: 'Salma', lastName: 'Kefi', email: box('live-candidat5'), password: 'Candidat@2026', role: 'candidat' },
  { firstName: 'Omar', lastName: 'Chebbi', email: box('live-candidat6'), password: 'Candidat@2026', role: 'candidat' },
];

const JOBS = [
  { title: 'Développeur·se Full Stack', metier: 'dev-fullstack', requiredSkills: ['JavaScript', 'React', 'Node.js', 'Express', 'MongoDB', 'API REST', 'Docker'], niceToHaveSkills: ['TypeScript', 'Tests'], minExperienceYears: 2, languages: ['français', 'anglais'], matchThreshold: 55, salaryRange: '2 500 – 3 500 TND',
    description: 'Au sein de l\'équipe produit, vous développerez des API REST avec Node.js et Express, des interfaces React réactives et accessibles, et vous modéliserez les données dans MongoDB. Vous participerez aux revues de code, écrirez des tests automatisés et contribuerez au déploiement conteneurisé avec Docker.' },
  { title: 'Data Scientist', metier: 'data-scientist', requiredSkills: ['Python', 'Pandas', 'Machine Learning', 'Statistiques', 'SQL'], niceToHaveSkills: ['Deep Learning', 'NLP'], minExperienceYears: 1, languages: ['français', 'anglais'], matchThreshold: 55,
    description: 'Vous concevrez des modèles de machine learning pour prédire l\'attrition des clients, analyserez de grands jeux de données avec Python et Pandas, présenterez vos résultats aux équipes métier et suivrez la performance des modèles en production.' },
  { title: 'Ingénieur·e DevOps', metier: 'devops-cloud', requiredSkills: ['Docker', 'Kubernetes', 'CI/CD', 'Linux', 'Terraform'], niceToHaveSkills: ['AWS', 'Monitoring'], minExperienceYears: 3, languages: ['français'], matchThreshold: 60,
    description: 'Vous automatiserez les chaînes d\'intégration et de déploiement continus, administrerez des clusters Kubernetes, décrirez l\'infrastructure en code avec Terraform et mettrez en place la supervision des services en production.' },
  { title: 'Designer UX/UI', metier: 'designer-ux', requiredSkills: ['Figma', 'Recherche utilisateur', 'Prototypage', 'Accessibilité'], niceToHaveSkills: ['Design system'], minExperienceYears: 1, languages: ['français'], matchThreshold: 55, remote: 'télétravail',
    description: 'Vous mènerez la recherche utilisateur, concevrez des parcours et prototypes interactifs dans Figma, ferez évoluer notre design system et veillerez à l\'accessibilité de toutes nos interfaces.' },
  { title: 'Chargé·e de Marketing Digital', metier: 'marketing-digital', requiredSkills: ['SEO', 'SEA', 'Réseaux sociaux', 'Google Analytics'], niceToHaveSkills: ['Emailing', 'CRM'], minExperienceYears: 1, languages: ['français', 'anglais'], matchThreshold: 50, contractType: 'CDD',
    description: 'Vous piloterez nos campagnes d\'acquisition sur Google Ads et les réseaux sociaux, optimiserez le référencement naturel du site et analyserez les performances dans Google Analytics pour ajuster les budgets.' },
  { title: 'Comptable confirmé·e', metier: 'comptable', requiredSkills: ['Comptabilité générale', 'Fiscalité', 'Excel', 'ERP'], niceToHaveSkills: ['Contrôle de gestion'], minExperienceYears: 3, languages: ['français'], matchThreshold: 60, location: 'Sfax', remote: 'sur site',
    description: 'Vous assurerez la tenue de la comptabilité générale, les déclarations fiscales et la TVA, les clôtures mensuelles et annuelles dans l\'ERP, et produirez les tableaux de bord sous Excel.' },
  { title: 'Lead Développeur·se Node.js (stage de fin d\'études)', metier: 'dev-fullstack', requiredSkills: ['Node.js', 'TypeScript', 'Docker', 'Tests', 'SQL'], minExperienceYears: 0, languages: ['français'], matchThreshold: 70, contractType: 'Stage', status: 'publiee',
    description: 'Stage de fin d\'études : vous concevrez un micro-service Node.js en TypeScript, avec base SQL, tests automatisés et déploiement Docker, accompagné·e par un développeur senior.' },
];

const CVS = {
  amira: ['Amira Ben Salah — Développeuse Full Stack', 'Tunis · amira@example.com', 'EXPÉRIENCE', '2022 - aujourd\'hui : Développeuse Full Stack chez Vermeg', '- Conception d\'API REST avec Node.js et Express, base MongoDB (Mongoose), authentification JWT.',
    '- Interfaces React avec hooks, React Query et Tailwind CSS ; tests Jest.', '- Conteneurisation des services avec Docker et intégration continue GitHub Actions.', '2021 - 2022 : Stage développeur web chez Sofrecom (JavaScript, SQL).',
    'FORMATION', 'Diplôme d\'ingénieur en informatique — ESPRIT (2022)', 'COMPÉTENCES : JavaScript, TypeScript, React, Node.js, Express, MongoDB, Docker, Git, Jest', 'LANGUES : Français (courant), Anglais (B2), Arabe (natif)'],
  youssef: ['Youssef Trabelsi — Data Scientist', 'Tunis · youssef@example.com', 'EXPERIENCE', '2023 - present: Data Scientist at InstaDeep', '- Built machine learning models with scikit-learn and PyTorch for churn prediction.',
    '- Data cleaning and analysis with Python and Pandas, SQL queries on PostgreSQL.', '- Statistical tests and A/B testing, dashboards in Power BI.', 'EDUCATION', 'Master in Data Science — ESPRIT (2023)',
    'SKILLS: Python, Pandas, NumPy, scikit-learn, PyTorch, SQL, statistics, NLP with transformers', 'LANGUAGES: English (fluent), French (fluent), Arabic (native)'],
  ines: ['Ines Gharbi — Designer UX/UI', 'Ariana · ines@example.com', 'EXPÉRIENCE', '2022 - 2025 : Designer UX/UI chez Expensya', '- Recherche utilisateur : entretiens, personas, tests d\'utilisabilité.',
    '- Maquettes et prototypes interactifs dans Figma ; contribution au design system.', '- Audit d\'accessibilité WCAG et corrections avec les développeurs.', 'FORMATION : Master design numérique (2022)', 'COMPÉTENCES : Figma, prototypage, recherche utilisateur, accessibilité, HTML/CSS', 'LANGUES : Français, Anglais'],
  mehdi: ['Mehdi Bouazizi — Développeur web', 'Sousse · mehdi@example.com', 'EXPÉRIENCE', '2024 - aujourd\'hui : Développeur web junior chez une agence', '- Intégration de sites avec HTML, CSS et JavaScript.', '- Quelques composants React.',
    'FORMATION : Licence en informatique (2024)', 'COMPÉTENCES : HTML, CSS, JavaScript, React, Git', 'LANGUES : Français, Arabe'],
  salma: ['Salma Kefi — Comptable', 'Sfax · salma@example.com', 'EXPÉRIENCE', '2019 - aujourd\'hui : Comptable chez un cabinet d\'expertise', '- Tenue de la comptabilité générale, déclarations fiscales et TVA.', '- Clôtures mensuelles, rapprochements bancaires, reporting sous Excel.', '- Saisie dans l\'ERP Sage.',
    'FORMATION : Licence en comptabilité (2019)', 'COMPÉTENCES : Comptabilité générale, Fiscalité, Excel, Sage, contrôle de gestion', 'LANGUES : Français, Arabe'],
};

// Réponses ÉCRITES de démonstration (notées par le vrai correcteur sémantique au moment du seed).
const ANSWERS = {
  strong: [
    'Je suis ingénieure en informatique diplômée d\'ESPRIT. Depuis trois ans je développe des applications web complètes, des API Node.js jusqu\'aux interfaces React, et ce poste correspond exactement à ce que je veux approfondir.',
    'Pour l\'état, je garde l\'état local dans le composant avec useState, je remonte l\'état ou j\'utilise un contexte quand plusieurs composants le partagent, et pour le cache des données serveur j\'utilise React Query. J\'évite les rendus inutiles avec la mémoïsation.',
    'Je commence par mesurer avec explain pour trouver la requête lente, j\'ajoute un index adapté sur les champs filtrés, je limite les données renvoyées avec une projection et la pagination, puis je vérifie le gain.',
    'Dans un projet, deux collègues n\'étaient pas d\'accord sur l\'architecture. J\'ai organisé une réunion, chacun a présenté ses arguments, on a fait un petit prototype et on a choisi ensemble. Le projet a été livré à temps et j\'ai appris à faciliter les discussions.',
    'Votre mission dans le recrutement m\'intéresse beaucoup, le poste correspond à mes compétences et dans deux ans je me vois référente technique, en continuant à apprendre.',
  ],
  medium: [
    'Bonjour, je suis développeur, j\'ai fait une licence et je travaille dans une agence web.',
    'Euh, j\'utilise useState dans les composants, et parfois un contexte.',
    'Je regarde le code et j\'essaie de l\'optimiser, peut-être ajouter un index.',
    'Une fois il y avait un retard sur un projet, j\'ai travaillé plus tard pour finir.',
    'J\'aime bien votre entreprise et je veux progresser.',
  ],
  data: [
    'I am a data scientist with a master from ESPRIT. For two years I have built machine learning models for churn prediction, and I want to bring this experience to your team.',
    'First I clarify the business need and the success metric, then I clean and explore the data, split train and test sets with cross validation, compare several models and finally deploy and monitor drift.',
    'For an imbalanced dataset I choose adapted metrics like recall, F1 or AUC-PR, I use resampling such as SMOTE or class weights, and I tune the decision threshold.',
    'In a project the data was late and the deadline was close. I talked with the data owners, proposed a smaller first version and we delivered on time; I learned to communicate risks early.',
    'Your mission and your data projects motivate me, and in two years I see myself leading data projects while keeping learning.',
  ],
  compta: [
    'Bonjour, je suis comptable depuis plusieurs années dans un cabinet, je fais la comptabilité générale et la fiscalité.',
    'Pour la clôture je fais les rapprochements bancaires, les amortissements, et je vérifie les comptes.',
    'Euh, je regarde les postes où il y a un écart et je demande aux opérationnels.',
    'Une fois un client était en retard pour ses pièces, je l’ai relancé plusieurs fois et on a fini à temps.',
    'Je veux évoluer vers le contrôle de gestion et votre entreprise me plaît.',
  ],
};

// Questions effectivement posées dans ces parcours de démo : présentation, 2 questions techniques de la banque
// du métier (indices techIdx, celles auxquelles répondent les textes ci-dessus), situation, motivation.
function demoQuestions(metier, techIdx) {
  const bank = METIERS[metier].interview;
  return [COMMON.presentation, bank[techIdx[0]], bank[techIdx[1]], COMMON.situation, COMMON.motivation].map((q, i) => ({
    order: i + 1, type: q.type, skill: q.skill, text: q.fr, keyPoints: q.keyPoints, timeLimitSec: TIME[q.type], source: 'banque',
  }));
}

async function completeJourney({ candidate, job, cv, quizPercentTarget, answers, techIdx }) {
  const cvText = cv.join('\n');
  const app = new Application({ candidate: candidate._id, job: job._id, cvFileName: `CV_${candidate.lastName}.pdf`, cvFile: textPdf(cv), cvText });
  app.moveTo('soumise', 'Candidature déposée');
  app.matching = await matching.match({ cvText, job });
  const quiz = await Quiz.findOne({ metier: job.metier, status: 'actif' });
  const picked = quiz.questions.slice(0, quiz.questionsPerAttempt);
  const nCorrect = Math.round((quizPercentTarget / 100) * picked.length);
  const perSkill = new Map();
  const answersQ = picked.map((qq, i) => {
    const correct = i < nCorrect;
    const s = perSkill.get(qq.skill) || { correct: 0, total: 0 };
    s.total += 1;
    if (correct) s.correct += 1;
    perSkill.set(qq.skill, s);
    return { questionId: qq._id, selectedIndex: correct ? qq.correctIndex : (qq.correctIndex + 1) % qq.options.length, correct, points: correct ? qq.points : 0, skill: qq.skill, timeMs: 20000 };
  });
  const max = picked.reduce((a, qq) => a + qq.points, 0);
  const score = answersQ.reduce((a, x) => a + x.points, 0);
  const daysAgo = Math.floor(Math.random() * 40) + 2;
  const at = new Date(Date.now() - daysAgo * 86400000);
  const attempt = await QuizAttempt.create({
    quiz: quiz._id, application: app._id, candidate: candidate._id, questionIds: picked.map((qq) => qq._id), answers: answersQ, score, maxScore: max, percent: Math.round((100 * score) / max),
    passed: (100 * score) / max >= quiz.passingScore, perSkill: [...perSkill].map(([skill, s]) => ({ skill, ...s, percent: Math.round((100 * s.correct) / s.total) })), status: 'terminee', startedAt: at, deadlineAt: new Date(at.getTime() + 480000), submittedAt: new Date(at.getTime() + 300000),
  });
  app.quiz = quiz._id;
  app.quizAttempt = attempt._id;
  app.moveTo('invitee', 'Invitation (démo)');
  app.moveTo('quiz_termine', `Quiz : ${attempt.percent}/100`);
  await app.save();

  const questions = demoQuestions(job.metier, techIdx);
  const itv = new Interview({
    application: app._id, candidate: candidate._id, candidateName: `${candidate.firstName} ${candidate.lastName}`, job: job._id, quizAttempt: attempt._id, metier: job.metier,
    title: `Entretien — ${job.title}`, scheduledAt: at, expiresAt: new Date(at.getTime() + 7 * 86400000), meet: { provider: 'jitsi', link: `https://meet.jit.si/TalentWaveLive-demo-${String(app._id).slice(-8)}` },
    questions, status: 'termine', startedAt: new Date(at.getTime() + 3600000), endedAt: new Date(at.getTime() + 3600000 + 290000),
  });
  for (let i = 0; i < questions.length; i += 1) {
    const text = answers[i];
    const s = await scorer.scoreAnswer(questions[i], { transcript: text, inputMode: 'texte' }, { metierLabel: metierLabel(job.metier), useLlm: false });
    itv.answers.push({ questionIndex: i, transcript: text, inputMode: 'texte', detectedLanguage: 'fr', durationSec: 40, scores: s.scores, score: s.score, coveredPoints: s.coveredPoints, missedPoints: s.missedPoints, feedback: s.feedback });
  }
  itv.evaluation = await evaluator.evaluate({ interview: itv, quizPercent: attempt.percent, useLlm: false });
  itv.status = 'evalue';
  await itv.save();
  app.interview = itv._id;
  app.moveTo('entretien_termine', `Entretien : ${itv.evaluation.overall}/100`);
  await app.save();
  return { app, itv };
}

(async () => {
  await mongoose.connect(env.mongoUri);
  const existing = await User.countDocuments();
  if (existing && !process.argv.includes('--force')) {
    console.log(`La base ${mongoose.connection.name} contient déjà ${existing} compte(s) : rien n'est modifié. Relancez avec « npm run seed -- --force » pour tout remplacer.`);
    await mongoose.disconnect();
    return;
  }
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Job, Quiz, QuizAttempt, Application, Interview].map((m) => m.syncIndexes()));

  const users = [];
  for (const u of USERS) users.push(await User.create(u));
  const [, rh, rh2, amira, youssef, ines, mehdi, salma] = users;

  const jobs = [];
  for (const [i, j] of JOBS.entries()) jobs.push(await Job.create({ ...j, recruiter: i % 2 ? rh2._id : rh._id }));

  for (const m of [...new Set(JOBS.map((j) => j.metier))]) {
    const questions = quizGenerator.fromBank(m, { count: 10 });
    await Quiz.create({ title: `Quiz de compétences — ${metierLabel(m)}`, description: `Questions de la banque du métier ${metierLabel(m)}.`, metier: m, durationMinutes: 8, passingScore: 60, questionsPerAttempt: Math.min(8, questions.length), questions, source: 'banque', createdBy: rh._id });
  }

  console.log('Parcours de démonstration notés par le correcteur sémantique (MiniLM)…');
  const journeys = [
    await completeJourney({ candidate: amira, job: jobs[0], cv: CVS.amira, quizPercentTarget: 88, answers: ANSWERS.strong, techIdx: [0, 2] }),
    await completeJourney({ candidate: mehdi, job: jobs[0], cv: CVS.mehdi, quizPercentTarget: 50, answers: ANSWERS.medium, techIdx: [0, 2] }),
    await completeJourney({ candidate: youssef, job: jobs[1], cv: CVS.youssef, quizPercentTarget: 75, answers: ANSWERS.data, techIdx: [0, 1] }),
    await completeJourney({ candidate: salma, job: jobs[5], cv: CVS.salma, quizPercentTarget: 63, answers: ANSWERS.compta, techIdx: [0, 1] }),
  ];
  // Une décision déjà prise, pour l'exemple.
  journeys[0].itv.decision = { value: 'retenu', comment: 'Excellent entretien technique.', by: rh._id, at: new Date() };
  await journeys[0].itv.save();
  journeys[0].app.moveTo('retenue', 'Décision du recruteur');
  await journeys[0].app.save();

  console.log(`\nBase ${mongoose.connection.name} prête :`);
  for (const u of USERS) console.log(`  ${u.role.padEnd(9)} ${u.email.padEnd(42)} ${u.password}`);
  console.log(`  ${jobs.length} offres, ${await Quiz.countDocuments()} quiz, ${journeys.length} entretiens évalués (${journeys.map((j) => j.itv.evaluation.overall).join(', ')}/100)`);
  console.log(`  Ines (${ines.email}) n'a pas encore postulé : utilisez-la pour tester le parcours complet.`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
