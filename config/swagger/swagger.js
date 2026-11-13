/**
 * Spécification OpenAPI 3 (Swagger UI : http://localhost:8200/api-docs).
 * Construite avec de petits assistants pour rester lisible : op(tag, résumé, options).
 */
const env = require('../env');
const { METIER_KEYS } = require('../../controller/ai/data/metiers');

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema, example) => ({ content: { 'application/json': { schema, ...(example ? { example } : {}) } } });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', example: '665f1c2a1b2c3d4e5f607182' } };
const q = (name, schema, description) => ({ name, in: 'query', schema, description });
const listParams = (extra = []) => [
  q('page', { type: 'integer', minimum: 1, default: 1 }, 'Page'),
  q('limit', { type: 'integer', minimum: 1, maximum: 100, default: 10 }, 'Éléments par page'),
  q('q', { type: 'string' }, 'Recherche (insensible aux accents et à la casse)'),
  q('sort', { type: 'string' }, 'Tri : champ ou -champ (décroissant), plusieurs séparés par des virgules'),
  ...extra,
];
const R = {
  200: { description: 'OK', ...json(ref('Success')) },
  201: { description: 'Créé', ...json(ref('Success')) },
  202: { description: 'Accepté (traitement en arrière-plan)', ...json(ref('Success')) },
  400: { $ref: '#/components/responses/BadRequest' },
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  404: { $ref: '#/components/responses/NotFound' },
  409: { $ref: '#/components/responses/Conflict' },
  422: { $ref: '#/components/responses/Validation' },
  429: { $ref: '#/components/responses/TooMany' },
};
function op(tag, summary, { description, params = [], body, multipart, ok = 200, errors = [401, 422], secure = true } = {}) {
  const o = { tags: [tag], summary, responses: { [ok]: R[ok] } };
  if (description) o.description = description;
  if (secure) o.security = [{ bearerAuth: [] }];
  if (params.length) o.parameters = params;
  if (body) o.requestBody = { required: true, ...json(body.schema, body.example) };
  if (multipart) o.requestBody = { required: true, content: { 'multipart/form-data': { schema: multipart } } };
  for (const e of errors) o.responses[e] = R[e];
  return o;
}

const metier = { type: 'string', enum: METIER_KEYS };

const schemas = {
  Success: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: { type: 'object' } } },
  Error: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false }, code: { type: 'string', example: 'VALIDATION_ERROR' }, message: { type: 'string' },
      errors: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } },
    },
  },
  Pagination: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, pages: { type: 'integer' }, hasNext: { type: 'boolean' }, hasPrev: { type: 'boolean' } } },
  Signup: { type: 'object', required: ['firstName', 'lastName', 'email', 'password'], properties: { firstName: { type: 'string' }, lastName: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', description: '8 caractères min., une minuscule, une majuscule, un chiffre' }, phone: { type: 'string' }, preferredLanguage: { type: 'string', enum: ['fr', 'en'] } } },
  Job: {
    type: 'object',
    required: ['title', 'metier', 'description'],
    properties: {
      title: { type: 'string' }, metier, description: { type: 'string', minLength: 30 }, requiredSkills: { type: 'array', items: { type: 'string' } }, niceToHaveSkills: { type: 'array', items: { type: 'string' } },
      minExperienceYears: { type: 'number' }, languages: { type: 'array', items: { type: 'string' } }, location: { type: 'string' }, contractType: { type: 'string', enum: ['CDI', 'CDD', 'Stage', 'Freelance', 'Alternance'] },
      remote: { type: 'string', enum: ['sur site', 'hybride', 'télétravail'] }, salaryRange: { type: 'string' }, matchThreshold: { type: 'integer', minimum: 0, maximum: 100, description: 'Score minimal pour l\'invitation automatique' }, status: { type: 'string', enum: ['brouillon', 'publiee', 'fermee'] },
    },
  },
  QuizQuestion: {
    type: 'object',
    required: ['text', 'options', 'correctIndex', 'skill'],
    properties: { text: { type: 'string' }, options: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'string' } }, correctIndex: { type: 'integer' }, explanation: { type: 'string' }, skill: { type: 'string' }, points: { type: 'integer', minimum: 1, maximum: 10 }, difficulty: { type: 'string', enum: ['facile', 'moyen', 'difficile'] } },
  },
  Quiz: {
    type: 'object',
    required: ['title', 'metier', 'questions'],
    properties: {
      title: { type: 'string' }, description: { type: 'string' }, metier, job: { type: 'string', nullable: true }, language: { type: 'string', enum: ['fr', 'en'] }, difficulty: { type: 'string', enum: ['facile', 'moyen', 'difficile'] },
      durationMinutes: { type: 'integer', minimum: 2, maximum: 60 }, passingScore: { type: 'integer', minimum: 0, maximum: 100 }, questionsPerAttempt: { type: 'integer' }, shuffleQuestions: { type: 'boolean' }, maxAttempts: { type: 'integer' },
      status: { type: 'string', enum: ['actif', 'inactif', 'archive'] }, questions: { type: 'array', items: ref('QuizQuestion') },
    },
  },
  InterviewUpdate: {
    type: 'object',
    properties: { scheduledAt: { type: 'string', format: 'date-time' }, expiresAt: { type: 'string', format: 'date-time' }, language: { type: 'string', enum: ['fr', 'en'] }, durationMinutes: { type: 'integer' }, recruiterNotes: { type: 'string' }, status: { type: 'string', enum: ['planifie', 'annule'] }, avatar: { type: 'object', properties: { name: { type: 'string' }, voice: { type: 'string', enum: ['feminine', 'masculine'] } } } },
  },
};

const errorResponse = (description, example) => ({ description, ...json(ref('Error'), example) });

const quizExample = {
  title: 'Quiz React & Node — niveau confirmé', metier: 'dev-fullstack', durationMinutes: 6, passingScore: 60, language: 'fr', difficulty: 'moyen',
  questions: [
    { text: 'Quel hook React gère un effet de bord ?', options: ['useMemo', 'useEffect', 'useRef', 'useId'], correctIndex: 1, skill: 'React', explanation: 'useEffect exécute un effet après le rendu.' },
    { text: 'Quel code HTTP pour une ressource créée ?', options: ['200', '201', '204', '400'], correctIndex: 1, skill: 'API REST' },
  ],
};

const T = { auth: 'Auth', users: 'Utilisateurs', jobs: 'Offres', apps: 'Candidatures', quiz: 'Quiz', attempts: 'Passage du quiz', itv: 'Entretiens', live: 'Entretien en direct', bot: 'Chatbot', stats: 'Statistiques' };

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'TalentWave Live API',
    version: '1.0.0',
    description: 'Recrutement de bout en bout (équipe DataWave, ESPRIT).\n\n'
      + '**Parcours** : `POST /api/applications` (bouton Postuler, CV PDF) → job matching IA → e-mail d\'acceptation (quiz + salle d\'entretien + Meet) '
      + '→ quiz chronométré → entretien vidéo de 5 min avec l\'avatar (`start` / `answers` / `finish`) → évaluation → décision du recruteur.\n\n'
      + '**Authentification** : `POST /api/auth/login` renvoie `accessToken` (bouton **Authorize**). Comptes de démonstration : voir README.',
  },
  servers: [{ url: `http://localhost:${env.port}`, description: 'Local' }],
  tags: Object.values(T).map((name) => ({ name })),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas,
    responses: {
      BadRequest: errorResponse('Requête invalide', { success: false, code: 'INVALID_ID', message: 'Identifiant invalide : abc' }),
      Unauthorized: errorResponse('Non authentifié', { success: false, code: 'AUTH_REQUIRED', message: 'Authentification requise.' }),
      Forbidden: errorResponse('Rôle insuffisant', { success: false, code: 'FORBIDDEN', message: 'Vous n\'avez pas les droits pour cette action.' }),
      NotFound: errorResponse('Introuvable', { success: false, code: 'QUIZ_NOT_FOUND', message: 'Quiz introuvable.' }),
      Conflict: errorResponse('Conflit avec l\'état actuel', { success: false, code: 'ALREADY_APPLIED', message: 'Vous avez déjà postulé à cette offre.' }),
      Validation: errorResponse('Validation échouée', { success: false, code: 'VALIDATION_ERROR', message: 'Les données envoyées sont invalides.', errors: [{ field: 'email', message: 'Adresse e-mail invalide.' }] }),
      TooMany: errorResponse('Trop de requêtes', { success: false, code: 'RATE_LIMITED', message: 'Trop de tentatives.' }),
    },
  },
  paths: {
    '/api/health': { get: op(T.auth, 'État de l\'API et de MongoDB', { secure: false, errors: [] }) },
    '/api/auth/signup': { post: op(T.auth, 'Inscription (candidat)', { secure: false, ok: 201, errors: [409, 422, 429], body: { schema: ref('Signup'), example: { firstName: 'Amira', lastName: 'Ben Salah', email: 'amira@example.com', password: 'Candidat@2026', preferredLanguage: 'fr' } } }) },
    '/api/auth/login': { post: op(T.auth, 'Connexion', { secure: false, errors: [401, 403, 422, 429], body: { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } } }, example: { email: 'recruteur@talentwave.tn', password: 'Recruteur@2026' } } }) },
    '/api/auth/refresh': { post: op(T.auth, 'Renouveler la session (cookie httpOnly ou refreshToken dans le corps)', { secure: false, errors: [401], body: { schema: { type: 'object', properties: { refreshToken: { type: 'string' } } } } }) },
    '/api/auth/logout': { post: op(T.auth, 'Déconnexion (révoque le refresh token)', { errors: [401] }) },
    '/api/auth/forgot-password': { post: op(T.auth, 'Mot de passe oublié : e-mail avec lien valable 15 min', { secure: false, errors: [422, 429], body: { schema: { type: 'object', properties: { email: { type: 'string' } } }, example: { email: 'amira@example.com' } } }) },
    '/api/auth/reset-password': { post: op(T.auth, 'Nouveau mot de passe (jeton de l\'e-mail, usage unique)', { secure: false, errors: [400, 422], body: { schema: { type: 'object', properties: { token: { type: 'string' }, password: { type: 'string' } } } } }) },
    '/api/auth/me': {
      get: op(T.auth, 'Mon profil', { errors: [401] }),
      patch: op(T.auth, 'Modifier mon profil', { body: { schema: { type: 'object', properties: { firstName: { type: 'string' }, lastName: { type: 'string' }, phone: { type: 'string' }, preferredLanguage: { type: 'string', enum: ['fr', 'en'] } } } } }),
    },
    '/api/auth/change-password': { post: op(T.auth, 'Changer mon mot de passe', { errors: [400, 401, 422], body: { schema: { type: 'object', properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string' } } } } }) },

    '/api/users': {
      get: op(T.users, 'Lister les utilisateurs (admin)', { params: listParams([q('role', { type: 'string', enum: ['candidat', 'recruteur', 'admin'] }), q('blocked', { type: 'string', enum: ['true', 'false'] })]), errors: [401, 403, 422] }),
      post: op(T.users, 'Créer un utilisateur (admin)', { ok: 201, errors: [401, 403, 409, 422], body: { schema: ref('Signup') } }),
    },
    '/api/users/{id}': {
      patch: op(T.users, 'Modifier rôle / blocage (admin)', { params: [idParam], errors: [401, 403, 404, 409, 422], body: { schema: { type: 'object', properties: { role: { type: 'string' }, isBlocked: { type: 'boolean' } } } } }),
      delete: op(T.users, 'Supprimer (admin)', { params: [idParam], errors: [401, 403, 404, 409] }),
    },

    '/api/metiers': { get: op(T.jobs, 'Catalogue des métiers (compétences, pondérations, banques de questions)', { secure: false, errors: [] }) },
    '/api/jobs': {
      get: op(T.jobs, 'Lister les offres (publiques ; recruteur : toutes)', { secure: false, errors: [422], params: listParams([q('metier', metier), q('contractType', { type: 'string' }), q('remote', { type: 'string' }), q('status', { type: 'string' }), q('location', { type: 'string' }), q('maxExperience', { type: 'number' }), q('mine', { type: 'string', enum: ['true', 'false'] })]) }),
      post: op(T.jobs, 'Créer une offre (recruteur)', { ok: 201, errors: [401, 403, 422], body: { schema: ref('Job'), example: { title: 'Développeur·se Full Stack', metier: 'dev-fullstack', description: 'Vous développerez des API Node.js/Express et des interfaces React pour notre plateforme RH.', requiredSkills: ['JavaScript', 'React', 'Node.js'], minExperienceYears: 2, matchThreshold: 55 } } }),
    },
    '/api/jobs/{id}': {
      get: op(T.jobs, 'Détail d\'une offre', { secure: false, params: [idParam], errors: [404] }),
      patch: op(T.jobs, 'Modifier une offre', { params: [idParam], errors: [401, 403, 404, 422], body: { schema: ref('Job') } }),
      delete: op(T.jobs, 'Supprimer une offre (sans candidature)', { params: [idParam], errors: [401, 403, 404, 409] }),
    },

    '/api/applications': {
      post: op(T.apps, 'POSTULER : CV PDF → matching IA → invitation (quiz + entretien + Meet) ou refus expliqué', {
        ok: 201, errors: [401, 403, 404, 409, 413, 415, 422].filter((e) => R[e]),
        description: 'Le score (0-100) combine compétences (45 %), proximité sémantique (25 %), expérience (20 %) et langues (10 %). Score ≥ seuil de l\'offre : e-mail d\'acceptation avec lien de quiz, salle d\'entretien avatar et lien Google Meet / Jitsi.',
        multipart: { type: 'object', required: ['jobId', 'cv'], properties: { jobId: { type: 'string' }, coverLetter: { type: 'string' }, cv: { type: 'string', format: 'binary' } } },
      }),
      get: op(T.apps, 'Lister les candidatures (candidat : les siennes)', { params: listParams([q('status', { type: 'string' }), q('job', { type: 'string' }), q('minScore', { type: 'number' }), q('maxScore', { type: 'number' }), q('mine', { type: 'string' })]) }),
    },
    '/api/applications/{id}': { get: op(T.apps, 'Détail (matching expliqué, quiz, entretien, historique)', { params: [idParam], errors: [401, 404] }) },
    '/api/applications/{id}/cv': { get: op(T.apps, 'Télécharger le CV PDF', { params: [idParam], errors: [401, 404] }) },
    '/api/applications/{id}/invite': { post: op(T.apps, 'Forcer l\'invitation (recruteur)', { params: [idParam], errors: [401, 403, 404, 409] }) },
    '/api/applications/{id}/reject': { post: op(T.apps, 'Refuser (recruteur)', { params: [idParam], errors: [401, 403, 404, 409], body: { schema: { type: 'object', properties: { note: { type: 'string' } } } } }) },
    '/api/applications/{id}/withdraw': { post: op(T.apps, 'Retirer ma candidature', { params: [idParam], errors: [401, 404, 409] }) },
    '/api/applications/{id}/quiz': { get: op(T.attempts, 'Quiz de ma candidature (sans les questions)', { params: [idParam], errors: [401, 404] }) },
    '/api/applications/{id}/quiz/start': { post: op(T.attempts, 'Démarrer (ou reprendre) le quiz chronométré — sans les bonnes réponses', { ok: 201, params: [idParam], errors: [401, 404, 409] }) },
    '/api/quiz-attempts/{id}/submit': { post: op(T.attempts, 'Envoyer les réponses : correction serveur, score par compétence', { params: [idParam], errors: [401, 404, 409, 422], body: { schema: { type: 'object', properties: { answers: { type: 'array', items: { type: 'object', properties: { questionId: { type: 'string' }, selectedIndex: { type: 'integer', nullable: true }, timeMs: { type: 'integer' } } } } } } } }) },
    '/api/quiz-attempts/{id}': { get: op(T.attempts, 'Résultat d\'un passage (correction après envoi)', { params: [idParam], errors: [401, 404] }) },

    '/api/quizzes': {
      get: op(T.quiz, 'Lister les quiz : recherche, filtres, tri, pagination (+ passages et moyenne)', { errors: [401, 403, 422], params: listParams([q('metier', metier), q('status', { type: 'string', enum: ['actif', 'inactif', 'archive'] }), q('difficulty', { type: 'string', enum: ['facile', 'moyen', 'difficile'] }), q('language', { type: 'string', enum: ['fr', 'en'] }), q('source', { type: 'string', enum: ['banque', 'ia', 'manuel'] }), q('job', { type: 'string' }), q('minDuration', { type: 'number' }), q('maxDuration', { type: 'number' }), q('minPassing', { type: 'number' }), q('maxPassing', { type: 'number' })]) }),
      post: op(T.quiz, 'Créer un quiz', { ok: 201, errors: [401, 403, 404, 422], body: { schema: ref('Quiz'), example: quizExample } }),
    },
    '/api/quizzes/stats': { get: op(T.stats, 'Statistiques des quiz (réussite, distribution, compétences, mois)', { params: [q('metier', metier)], errors: [401, 403] }) },
    '/api/quizzes/generate': { post: op(T.quiz, 'Générer un quiz (LLM local ou banque du métier), créé inactif', { ok: 201, errors: [401, 403, 404, 422, 429], body: { schema: { type: 'object', properties: { metier, job: { type: 'string' }, count: { type: 'integer' }, difficulty: { type: 'string' }, language: { type: 'string' }, mode: { type: 'string', enum: ['ia', 'banque'] } } }, example: { metier: 'data-scientist', count: 5, mode: 'ia' } } }) },
    '/api/quizzes/{id}': {
      get: op(T.quiz, 'Détail d\'un quiz (avec bonnes réponses)', { params: [idParam], errors: [401, 403, 404] }),
      patch: op(T.quiz, 'Modifier un quiz', { params: [idParam], errors: [401, 403, 404, 409, 422], body: { schema: ref('Quiz'), example: { passingScore: 70, status: 'actif' } } }),
      delete: op(T.quiz, 'Supprimer un quiz (refusé s\'il a déjà été passé : archiver)', { params: [idParam], errors: [401, 403, 404, 409] }),
    },
    '/api/quizzes/{id}/duplicate': { post: op(T.quiz, 'Dupliquer un quiz', { ok: 201, params: [idParam], errors: [401, 403, 404] }) },
    '/api/quizzes/{id}/attempts': { get: op(T.quiz, 'Passages d\'un quiz', { params: [idParam, ...listParams([q('status', { type: 'string' }), q('passed', { type: 'string' })])], errors: [401, 403, 404] }) },

    '/api/interviews': {
      get: op(T.itv, 'Lister les entretiens : recherche, filtres, tri, pagination', { params: listParams([q('status', { type: 'string', enum: ['planifie', 'en_cours', 'termine', 'evalue', 'annule', 'expire'] }), q('metier', metier), q('job', { type: 'string' }), q('language', { type: 'string' }), q('provider', { type: 'string', enum: ['google', 'jitsi'] }), q('recommendation', { type: 'string', enum: ['recommande', 'a_revoir', 'non_recommande'] }), q('decision', { type: 'string', enum: ['en_attente', 'retenu', 'non_retenu'] }), q('minScore', { type: 'number' }), q('maxScore', { type: 'number' }), q('from', { type: 'string', format: 'date-time' }), q('to', { type: 'string', format: 'date-time' })]) }),
      post: op(T.itv, 'Planifier un entretien pour une candidature (recruteur)', { ok: 201, errors: [401, 403, 404, 409, 422], body: { schema: { type: 'object', properties: { application: { type: 'string' }, scheduledAt: { type: 'string', format: 'date-time' }, language: { type: 'string' } } } } }),
    },
    '/api/interviews/stats': { get: op(T.stats, 'Statistiques des entretiens (notes, recommandations, langues, types de questions, mois)', { params: [q('metier', metier), q('job', { type: 'string' })], errors: [401, 403] }) },
    '/api/interviews/{id}': {
      get: op(T.itv, 'Détail (candidat : sans grille avant l\'évaluation)', { params: [idParam], errors: [401, 404] }),
      patch: op(T.itv, 'Modifier (créneau, langue, notes, annulation)', { params: [idParam], errors: [401, 403, 404, 409, 422], body: { schema: ref('InterviewUpdate'), example: { language: 'en', recruiterNotes: 'Profil intéressant' } } }),
      delete: op(T.itv, 'Supprimer un entretien', { params: [idParam], errors: [401, 403, 404, 409] }),
    },
    '/api/interviews/{id}/start': { post: op(T.live, 'Démarrer : 5 questions construites pour ce candidat (quiz + CV + offre)', { params: [idParam], errors: [401, 403, 404, 409], body: { schema: { type: 'object', properties: { language: { type: 'string', enum: ['fr', 'en'] } } } } }) },
    '/api/interviews/{id}/answers': {
      post: op(T.live, 'Répondre à une question : audio WAV (Whisper) ou texte — 202, analyse en arrière-plan', {
        ok: 202, params: [idParam], errors: [401, 403, 404, 409, 422],
        multipart: { type: 'object', required: ['questionIndex'], properties: { questionIndex: { type: 'integer' }, audio: { type: 'string', format: 'binary', description: 'WAV PCM 16 bits' }, transcript: { type: 'string', description: 'Réponse écrite (si pas d\'audio)' }, durationSec: { type: 'number' } } },
      }),
    },
    '/api/interviews/{id}/finish': { post: op(T.live, 'Terminer : évaluation finale (≈ 1 min) puis e-mail au recruteur', { ok: 202, params: [idParam], errors: [401, 404, 409] }) },
    '/api/interviews/{id}/evaluate': { post: op(T.itv, 'Réévaluer un entretien terminé', { params: [idParam], errors: [401, 403, 404, 409] }) },
    '/api/interviews/{id}/decision': { post: op(T.itv, 'Décision du recruteur (e-mail au candidat)', { params: [idParam], errors: [401, 403, 404, 409, 422], body: { schema: { type: 'object', properties: { value: { type: 'string', enum: ['retenu', 'non_retenu', 'en_attente'] }, comment: { type: 'string' }, notify: { type: 'boolean' } } }, example: { value: 'retenu', comment: 'Très bonne maîtrise technique.' } } }) },

    '/api/chatbot/message': { post: op(T.bot, 'Assistant (agent RAG + outils sur vos données)', { errors: [401, 422, 429], body: { schema: { type: 'object', properties: { message: { type: 'string' }, history: { type: 'array', items: { type: 'object' } } } }, example: { message: 'Où en est ma candidature et comment se passe l\'entretien ?' } } }) },
    '/api/chatbot/practice': { get: op(T.bot, 'Question d\'entraînement d\'un métier', { params: [q('metier', metier)] }) },
    '/api/chatbot/practice/evaluate': { post: op(T.bot, 'Noter une réponse d\'entraînement (même correcteur que l\'entretien)', { body: { schema: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } } } }) },

    '/api/stats/overview': { get: op(T.stats, 'Tableau de bord (entonnoir, chiffres clés)', { errors: [401, 403] }) },
    '/api/system/ai': { get: op(T.stats, 'État des modèles IA (Whisper, MiniLM, Ollama) et de la visio', { errors: [401, 403] }) },
  },
};
