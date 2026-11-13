/**
 * npm run postman : génère la collection Postman (TalentWave-Live.postman_collection.json) et son environnement.
 * Toute la collection s'enchaîne : chaque requête enregistre les identifiants utiles pour la suivante
 * (jetons, offre, candidature, quiz, tentative, entretien) et contient de vrais tests (pm.test).
 *
 * Parcours couvert : santé → authentification (inscription, connexion, mot de passe oublié via l'e-mail réellement envoyé,
 * refresh) → offres → POSTULER (CV PDF) → quiz (CRUD, recherche, filtres, tri, pagination, stats, génération)
 * → passage du quiz → entretien (CRUD, démarrage, réponses texte + AUDIO WAV transcrit par Whisper, fin,
 * attente de l'évaluation, décision) → chatbot → statistiques → administration → erreurs attendues.
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;

/** Corps d'une fonction → lignes de script Postman (évite tout problème d'échappement). */
const script = (fn) => fn.toString().replace(/^[^{]*{\s*\n?/, '').replace(/\s*}\s*$/, '').split('\n').map((l) => l.replace(/^ {4}/, ''));
const tests = (fn) => [{ listen: 'test', script: { type: 'text/javascript', exec: script(fn) } }];
const pre = (fn) => ({ listen: 'prerequest', script: { type: 'text/javascript', exec: script(fn) } });

function req(name, method, url, { body, form, auth = '{{tokenCandidat}}', test, prerequest, description } = {}) {
  const raw = `{{baseUrl}}${url}`;
  const [p, qs] = url.split('?');
  const request = {
    method,
    header: [],
    url: {
      raw,
      host: ['{{baseUrl}}'],
      path: p.split('/').filter(Boolean),
      ...(qs ? { query: qs.split('&').map((kv) => { const [key, value = ''] = kv.split('='); return { key, value }; }) } : {}),
    },
  };
  if (description) request.description = description;
  if (auth) request.auth = { type: 'bearer', bearer: [{ key: 'token', value: auth, type: 'string' }] };
  else request.auth = { type: 'noauth' };
  if (body) {
    request.header.push({ key: 'Content-Type', value: 'application/json' });
    request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } };
  }
  if (form) request.body = { mode: 'formdata', formdata: form };
  const event = [];
  if (prerequest) event.push(pre(prerequest));
  if (test) event.push(...tests(test));
  return { name, event, request };
}
const folder = (name, description, item) => ({ name, description, item });

// ---------- Tests réutilisables ----------
const expect = (code) => new Function(`pm.test('Statut ${code}', () => pm.response.to.have.status(${code}));`);
const expectCode = (status, code) => new Function(`pm.test('Statut ${status}', () => pm.response.to.have.status(${status}));\npm.test('Code ${code}', () => pm.expect(pm.response.json().code).to.eql('${code}'));`);

const collection = {
  info: {
    name: 'TalentWave Live — API',
    description: 'Recrutement de bout en bout : candidature (CV PDF) → job matching IA → e-mail d\'acceptation (quiz + entretien + Meet) → quiz → entretien vidéo de 5 min avec l\'avatar (Whisper + notation) → décision.\n\nLancer toute la collection dans l\'ordre (Runner). Variables dans l\'environnement « TalentWave Live (test) ». Serveur de test : SERVEUR_POSTMAN.bat.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [],
  item: [
    folder('00 · Santé', 'API et MongoDB', [
      req('Santé de l\'API', 'GET', '/api/health', { auth: null, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Base connectée', () => pm.expect(pm.response.json().data.database).to.eql('connectée'));
      } }),
      req('Journal des e-mails envoyés (serveur SERVEUR_POSTMAN / TESTER_POSTMAN)', 'GET', '/api/test-mails', { auth: null, test: () => {
        const capture = pm.response.code === 200;
        pm.environment.set('mailCapture', String(capture));
        pm.test('Serveur de test détecté (sinon les tests d\'e-mails sont ignorés)', () => pm.expect([200, 404]).to.include(pm.response.code));
        if (!capture) console.warn('Serveur sans journal d\'e-mails : lancez SERVEUR_POSTMAN.bat pour tester aussi les e-mails.');
      } }),
      req('Swagger (spécification OpenAPI)', 'GET', '/api-docs.json', { auth: null, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('OpenAPI 3', () => pm.expect(pm.response.json().openapi).to.match(/^3\./));
      } }),
    ]),

    folder('01 · Authentification', 'Inscription, connexion, mot de passe oublié, refresh', [
      req('Connexion admin', 'POST', '/api/auth/login', { auth: null, body: { email: '{{adminEmail}}', password: '{{adminPassword}}' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.environment.set('tokenAdmin', pm.response.json().data.accessToken);
        pm.test('Rôle admin', () => pm.expect(pm.response.json().data.user.role).to.eql('admin'));
      } }),
      req('Connexion recruteur', 'POST', '/api/auth/login', { auth: null, body: { email: '{{recruteurEmail}}', password: '{{recruteurPassword}}' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.environment.set('tokenRecruteur', pm.response.json().data.accessToken);
        pm.environment.set('recruteurId', pm.response.json().data.user.id);
      } }),
      req('Inscription d\'un candidat', 'POST', '/api/auth/signup', {
        auth: null,
        prerequest: () => {
          const email = `raifguizani10+postman${Date.now()}@gmail.com`;
          pm.environment.set('candidatEmail', email);
          pm.environment.set('candidatPassword', 'Candidat@2026');
        },
        body: { firstName: 'Postman', lastName: 'Candidat', email: '{{candidatEmail}}', password: '{{candidatPassword}}', preferredLanguage: 'fr' },
        test: () => {
          pm.test('Statut 201', () => pm.response.to.have.status(201));
          const d = pm.response.json().data;
          pm.test('Rôle candidat, sans mot de passe', () => { pm.expect(d.user.role).to.eql('candidat'); pm.expect(d.user).to.not.have.property('password'); });
          pm.environment.set('tokenCandidat', d.accessToken);
          pm.environment.set('refreshCandidat', d.refreshToken);
        },
      }),
      req('Inscription : e-mail déjà utilisé (409)', 'POST', '/api/auth/signup', { auth: null, body: { firstName: 'Postman', lastName: 'Doublon', email: '{{candidatEmail}}', password: 'Candidat@2026' }, test: expectCode(409, 'DUPLICATE') }),
      req('Inscription : mot de passe faible (422)', 'POST', '/api/auth/signup', { auth: null, body: { firstName: 'A', lastName: 'B', email: 'pas-un-email', password: 'abc' }, test: () => {
        pm.test('Statut 422', () => pm.response.to.have.status(422));
        pm.test('Erreurs par champ', () => pm.expect(pm.response.json().errors.map((e) => e.field)).to.include.members(['email', 'password']));
      } }),
      req('Connexion : mauvais mot de passe (401)', 'POST', '/api/auth/login', { auth: null, body: { email: '{{candidatEmail}}', password: 'Mauvais@2026' }, test: expectCode(401, 'INVALID_CREDENTIALS') }),
      req('Mon profil', 'GET', '/api/auth/me', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('E-mail', () => pm.expect(pm.response.json().data.user.email).to.eql(pm.environment.get('candidatEmail')));
      } }),
      req('Sans jeton (401)', 'GET', '/api/auth/me', { auth: null, test: expectCode(401, 'AUTH_REQUIRED') }),
      req('Mot de passe oublié', 'POST', '/api/auth/forgot-password', { auth: null, body: { email: '{{candidatEmail}}' }, test: expect(200) }),
      req('E-mail reçu : lien de réinitialisation', 'GET', '/api/test-mails', { auth: null, prerequest: () => {
        if (pm.environment.get('mailCapture') !== 'true') pm.execution.skipRequest();
      }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const mail = pm.response.json().data.find((m) => m.template === 'resetPassword' && m.to === pm.environment.get('candidatEmail'));
        pm.test('E-mail de réinitialisation envoyé', () => pm.expect(mail).to.be.an('object'));
        const link = mail.links.find((l) => l.includes('token='));
        pm.environment.set('resetToken', decodeURIComponent(link.split('token=')[1]));
      } }),
      req('Réinitialiser le mot de passe', 'POST', '/api/auth/reset-password', { auth: null, prerequest: () => {
        if (pm.environment.get('mailCapture') !== 'true') pm.execution.skipRequest();
      }, body: { token: '{{resetToken}}', password: 'Nouveau@2026' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.environment.set('candidatPassword', 'Nouveau@2026');
      } }),
      req('Lien déjà utilisé (400)', 'POST', '/api/auth/reset-password', { auth: null, prerequest: () => {
        if (pm.environment.get('mailCapture') !== 'true') pm.execution.skipRequest();
      }, body: { token: '{{resetToken}}', password: 'Autre@2026x' }, test: expectCode(400, 'INVALID_TOKEN') }),
      req('Connexion avec le nouveau mot de passe', 'POST', '/api/auth/login', { auth: null, body: { email: '{{candidatEmail}}', password: '{{candidatPassword}}' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.environment.set('tokenCandidat', pm.response.json().data.accessToken);
        pm.environment.set('refreshCandidat', pm.response.json().data.refreshToken);
      } }),
      req('Renouveler la session (refresh)', 'POST', '/api/auth/refresh', { auth: null, body: { refreshToken: '{{refreshCandidat}}' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Nouveau refresh token (rotation)', () => pm.expect(pm.response.json().data.refreshToken).to.not.eql(pm.environment.get('refreshCandidat')));
        pm.environment.set('tokenCandidat', pm.response.json().data.accessToken);
      } }),
      // Délai de grâce de 30 s : un rechargement interrompu (ancien cookie conservé) ne doit pas déconnecter.
      req('Refresh précédent rejoué aussitôt : délai de grâce (200)', 'POST', '/api/auth/refresh', { auth: null, body: { refreshToken: '{{refreshCandidat}}' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.environment.set('refreshCandidatCourant', pm.response.json().data.refreshToken);
      } }),
      req('Nouvelle rotation', 'POST', '/api/auth/refresh', { auth: null, body: { refreshToken: '{{refreshCandidatCourant}}' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.environment.set('tokenCandidat', pm.response.json().data.accessToken);
      } }),
      req('Refresh de deux rotations en arrière (401)', 'POST', '/api/auth/refresh', { auth: null, body: { refreshToken: '{{refreshCandidat}}' }, test: expectCode(401, 'REFRESH_REVOKED') }),
    ]),

    folder('02 · Offres', 'Offres publiques, CRUD recruteur', [
      req('Catalogue des métiers', 'GET', '/api/metiers', { auth: null, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('6 métiers avec pondérations', () => { pm.expect(pm.response.json().data).to.have.length(6); pm.expect(pm.response.json().data[0].weights).to.have.property('technical'); });
      } }),
      req('Offres : recherche « full » + pagination', 'GET', '/api/jobs?q=full&page=1&limit=5', { auth: null, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Pagination', () => pm.expect(d.pagination).to.include.keys('page', 'limit', 'total', 'pages'));
        const job = d.items.find((j) => j.metier === 'dev-fullstack' && j.contractType === 'CDI');
        pm.environment.set('jobId', job.id);
        pm.test('Offre Full Stack trouvée', () => pm.expect(job.title).to.match(/Full Stack/));
      } }),
      req('Offres : filtre métier + tri titre', 'GET', '/api/jobs?metier=data-scientist&sort=title', { auth: null, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Seulement des Data Scientist', () => pm.response.json().data.items.forEach((j) => pm.expect(j.metier).to.eql('data-scientist')));
      } }),
      req('Créer une offre (recruteur)', 'POST', '/api/jobs', { auth: '{{tokenRecruteur}}', body: { title: 'Offre Postman — Data Analyst', metier: 'data-scientist', description: 'Analyse de données avec Python, Pandas et SQL ; tableaux de bord pour les équipes métier.', requiredSkills: ['Python', 'SQL'], minExperienceYears: 1, matchThreshold: 50 }, test: () => {
        pm.test('Statut 201', () => pm.response.to.have.status(201));
        pm.environment.set('jobPostmanId', pm.response.json().data.id);
      } }),
      req('Créer une offre : candidat interdit (403)', 'POST', '/api/jobs', { body: { title: 'Interdit', metier: 'comptable', description: 'Cette offre ne doit pas être créée par un candidat, test de rôle.' }, test: expectCode(403, 'FORBIDDEN') }),
      req('Modifier l\'offre', 'PATCH', '/api/jobs/{{jobPostmanId}}', { auth: '{{tokenRecruteur}}', body: { matchThreshold: 55, status: 'fermee' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Fermée', () => pm.expect(pm.response.json().data.status).to.eql('fermee'));
      } }),
      req('Supprimer l\'offre', 'DELETE', '/api/jobs/{{jobPostmanId}}', { auth: '{{tokenRecruteur}}', test: expect(200) }),
      req('Offre DevOps (pour la suite)', 'GET', '/api/jobs?metier=devops-cloud', { auth: null, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.environment.set('jobDevopsId', pm.response.json().data.items[0].id);
      } }),
      req('Détail d\'une offre', 'GET', '/api/jobs/{{jobId}}', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Pas encore postulé', () => pm.expect(pm.response.json().data.myApplication).to.eql(null));
      } }),
    ]),

    folder('03 · Postuler (CV PDF → matching IA → invitation)', 'Le point de départ du parcours', [
      req('POSTULER avec un CV PDF', 'POST', '/api/applications', {
        body: { jobId: '{{jobId}}', coverLetter: 'Passionnée par les applications web complètes.', cvFileName: 'CV_Postman.pdf', cvBase64: '{{cvBase64}}' },
        test: () => {
          pm.test('Statut 201', () => pm.response.to.have.status(201));
          const d = pm.response.json().data;
          pm.test('Score de matching 0-100 expliqué', () => { pm.expect(d.matching.score).to.be.within(0, 100); pm.expect(d.matching.explanation.length).to.be.above(0); });
          pm.test('Décomposition (compétences, sémantique, expérience, langues)', () => pm.expect(d.matching.breakdown).to.include.keys('skills', 'semantic', 'experience', 'languages'));
          pm.test('Invité·e en entretien (CV adapté)', () => pm.expect(d.status).to.eql('invitee'));
          pm.test('Lien de visioconférence créé', () => pm.expect(d.interview.meet.link).to.match(/^https:\/\/(meet\.google\.com|meet\.jit\.si)\//));
          pm.test('CV jamais renvoyé', () => pm.expect(d).to.not.have.property('cvFile'));
          pm.environment.set('applicationId', d.id);
          pm.environment.set('interviewId', d.interview.id);
        },
      }),
      req('E-mail d\'acceptation envoyé (quiz + salle + Meet)', 'GET', '/api/test-mails', { auth: null, prerequest: () => {
        if (pm.environment.get('mailCapture') !== 'true') pm.execution.skipRequest();
      }, test: () => {
        const mail = pm.response.json().data.find((m) => m.template === 'invitation' && m.to === pm.environment.get('candidatEmail'));
        pm.test('E-mail d\'invitation envoyé', () => pm.expect(mail).to.be.an('object'));
        pm.test('Liens quiz, salle d\'entretien et visio', () => {
          pm.expect(mail.links.some((l) => l.includes('/quiz/'))).to.eql(true);
          pm.expect(mail.links.some((l) => l.includes('/entretien/'))).to.eql(true);
          pm.expect(mail.links.some((l) => /meet\.(google|jit)/.test(l))).to.eql(true);
        });
      } }),
      req('Postuler deux fois (409)', 'POST', '/api/applications', { body: { jobId: '{{jobId}}', cvBase64: '{{cvBase64}}' }, test: expectCode(409, 'ALREADY_APPLIED') }),
      req('Postuler sans CV (422)', 'POST', '/api/applications', { body: { jobId: '{{jobDevopsId}}' }, test: expectCode(422, 'CV_REQUIRED') }),
      req('Postuler avec un fichier qui n\'est pas un PDF (422)', 'POST', '/api/applications', { body: { jobId: '{{jobDevopsId}}', cvBase64: 'Q2VjaSBuJ2VzdCBwYXMgdW4gUERG' }, test: expectCode(422, 'CV_NOT_PDF') }),
      req('Mes candidatures', 'GET', '/api/applications?status=invitee', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Ma candidature invitée', () => pm.expect(pm.response.json().data.items.map((a) => a.id)).to.include(pm.environment.get('applicationId')));
      } }),
      req('Détail de ma candidature (historique)', 'GET', '/api/applications/{{applicationId}}', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Historique : soumise puis invitée', () => pm.expect(pm.response.json().data.timeline.map((t) => t.status)).to.include.members(['soumise', 'invitee']));
      } }),
      req('Télécharger mon CV (PDF)', 'GET', '/api/applications/{{applicationId}}/cv', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('application/pdf', () => pm.expect(pm.response.headers.get('Content-Type')).to.include('application/pdf'));
      } }),
      req('Candidatures (recruteur) : filtre score ≥ 50, tri score', 'GET', '/api/applications?minScore=50&sort=-matching.score&limit=5', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const s = pm.response.json().data.items.map((a) => a.matching.score);
        pm.test('Scores ≥ 50 et décroissants', () => { s.forEach((x) => pm.expect(x).to.be.at.least(50)); pm.expect(s).to.eql([...s].sort((a, b) => b - a)); });
      } }),
    ]),

    folder('04 · Quiz — CRUD (entité 1)', 'Création, lecture, recherche, filtres, tri, pagination, modification, duplication, suppression, génération', [
      req('Créer un quiz', 'POST', '/api/quizzes', { auth: '{{tokenRecruteur}}', body: {
        title: 'Quiz Postman — React & API', metier: 'dev-fullstack', description: 'Quiz créé par la collection Postman', durationMinutes: 5, passingScore: 50, questionsPerAttempt: 3, language: 'fr', difficulty: 'moyen', status: 'inactif',
        questions: [
          { text: 'Quel hook React exécute un effet après le rendu ?', options: ['useMemo', 'useEffect', 'useRef', 'useId'], correctIndex: 1, skill: 'React', explanation: 'useEffect.' },
          { text: 'Quel code HTTP pour une création réussie ?', options: ['200', '201', '204', '404'], correctIndex: 1, skill: 'API REST' },
          { text: 'Quelle commande Git rejoue des commits sur une autre base ?', options: ['merge', 'rebase', 'stash', 'tag'], correctIndex: 1, skill: 'Git', points: 2, difficulty: 'difficile' },
        ],
      }, test: () => {
        pm.test('Statut 201', () => pm.response.to.have.status(201));
        const d = pm.response.json().data;
        pm.test('3 questions, compétences calculées', () => { pm.expect(d.questionCount).to.eql(3); pm.expect(d.skills).to.include.members(['React', 'API REST', 'Git']); });
        pm.environment.set('quizId', d.id);
      } }),
      req('Créer : bonne réponse hors des choix (422)', 'POST', '/api/quizzes', { auth: '{{tokenRecruteur}}', body: { title: 'Quiz invalide', metier: 'comptable', questions: [{ text: 'Question invalide ?', options: ['A', 'B'], correctIndex: 5, skill: 'Excel' }] }, test: expectCode(422, 'VALIDATION_ERROR') }),
      req('Créer : candidat interdit (403)', 'POST', '/api/quizzes', { body: { title: 'Interdit', metier: 'comptable', questions: [] }, test: () => pm.test('Statut 403', () => pm.response.to.have.status(403)) }),
      req('Lire un quiz (avec bonnes réponses)', 'GET', '/api/quizzes/{{quizId}}', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('correctIndex visible pour le recruteur', () => pm.expect(pm.response.json().data.questions[0]).to.have.property('correctIndex'));
      } }),
      req('Rechercher « postman » (insensible aux accents)', 'GET', '/api/quizzes?q=POSTMAN', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Trouvé', () => pm.expect(pm.response.json().data.items.map((x) => x.id)).to.include(pm.environment.get('quizId')));
      } }),
      req('Filtrer métier + statut, trier par durée, pagination', 'GET', '/api/quizzes?metier=dev-fullstack&status=inactif&sort=-durationMinutes&page=1&limit=2', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Filtres respectés', () => d.items.forEach((x) => { pm.expect(x.metier).to.eql('dev-fullstack'); pm.expect(x.status).to.eql('inactif'); }));
        pm.test('2 éléments maximum', () => pm.expect(d.items.length).to.be.at.most(2));
        pm.test('Liste légère (sans questions) + passages', () => { pm.expect(d.items[0]).to.not.have.property('questions'); pm.expect(d.items[0]).to.have.property('attempts'); });
      } }),
      req('Pagination : page 1 (limit=2)', 'GET', '/api/quizzes?sort=title&page=1&limit=2', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('2 éléments, page 1, pas de page précédente', () => { pm.expect(d.items).to.have.length(2); pm.expect(d.pagination.page).to.eql(1); pm.expect(d.pagination.hasPrev).to.eql(false); });
        pm.test('Nombre de pages = ceil(total / limit)', () => pm.expect(d.pagination.pages).to.eql(Math.ceil(d.pagination.total / 2)));
        pm.environment.set('page1Ids', JSON.stringify(d.items.map((x) => x.id)));
      } }),
      req('Pagination : page 2 (sans recouvrement)', 'GET', '/api/quizzes?sort=title&page=2&limit=2', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        const first = JSON.parse(pm.environment.get('page1Ids'));
        pm.test('Page 2 avec page précédente', () => { pm.expect(d.pagination.page).to.eql(2); pm.expect(d.pagination.hasPrev).to.eql(true); });
        pm.test('Aucun élément de la page 1', () => d.items.forEach((x) => pm.expect(first).to.not.include(x.id)));
      } }),
      req('Pagination : page au-delà de la fin (liste vide)', 'GET', '/api/quizzes?page=999&limit=10', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Liste vide, pas de page suivante', () => { pm.expect(pm.response.json().data.items).to.have.length(0); pm.expect(pm.response.json().data.pagination.hasNext).to.eql(false); });
      } }),
      req('Pagination : limit > 100 refusé (422)', 'GET', '/api/quizzes?limit=500', { auth: '{{tokenRecruteur}}', test: expectCode(422, 'VALIDATION_ERROR') }),
      req('Filtrer par plage de seuil (minPassing)', 'GET', '/api/quizzes?minPassing=55&sort=passingScore', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Seuils ≥ 55', () => pm.response.json().data.items.forEach((x) => pm.expect(x.passingScore).to.be.at.least(55)));
      } }),
      req('Modifier (seuil + statut actif)', 'PATCH', '/api/quizzes/{{quizId}}', { auth: '{{tokenRecruteur}}', body: { passingScore: 60, status: 'actif' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Valeurs modifiées', () => { pm.expect(pm.response.json().data.passingScore).to.eql(60); pm.expect(pm.response.json().data.status).to.eql('actif'); });
      } }),
      req('Dupliquer', 'POST', '/api/quizzes/{{quizId}}/duplicate', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 201', () => pm.response.to.have.status(201));
        pm.test('Copie inactive', () => pm.expect(pm.response.json().data.status).to.eql('inactif'));
        pm.environment.set('quizCopyId', pm.response.json().data.id);
      } }),
      req('Supprimer la copie', 'DELETE', '/api/quizzes/{{quizCopyId}}', { auth: '{{tokenRecruteur}}', test: expect(200) }),
      req('Lire un quiz supprimé (404)', 'GET', '/api/quizzes/{{quizCopyId}}', { auth: '{{tokenRecruteur}}', test: expectCode(404, 'QUIZ_NOT_FOUND') }),
      req('Générer depuis la banque du métier', 'POST', '/api/quizzes/generate', { auth: '{{tokenRecruteur}}', body: { metier: 'devops-cloud', count: 5, mode: 'banque' }, test: () => {
        pm.test('Statut 201', () => pm.response.to.have.status(201));
        pm.test('5 questions, inactif', () => { pm.expect(pm.response.json().data.quiz.questions).to.have.length(5); pm.expect(pm.response.json().data.quiz.status).to.eql('inactif'); });
        pm.environment.set('quizGenId', pm.response.json().data.quiz.id);
      } }),
      req('Supprimer le quiz généré', 'DELETE', '/api/quizzes/{{quizGenId}}', { auth: '{{tokenRecruteur}}', test: expect(200) }),
      req('Identifiant invalide (422)', 'GET', '/api/quizzes/abc', { auth: '{{tokenRecruteur}}', test: () => pm.test('Statut 422', () => pm.response.to.have.status(422)) }),
    ]),

    folder('05 · Quiz — passage par le candidat', 'Chrono serveur, correction serveur, score par compétence', [
      req('Quiz de ma candidature', 'GET', '/api/applications/{{applicationId}}/quiz', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Pas de question avant le démarrage', () => pm.expect(pm.response.json().data.quiz).to.not.have.property('questions'));
        pm.test('Disponible', () => pm.expect(pm.response.json().data.canStart).to.eql(true));
      } }),
      req('Entretien avant le quiz : refusé (409)', 'POST', '/api/interviews/{{interviewId}}/start', { body: { language: 'fr' }, test: expectCode(409, 'QUIZ_REQUIRED') }),
      req('Démarrer le quiz', 'POST', '/api/applications/{{applicationId}}/quiz/start', { test: () => {
        pm.test('Statut 201', () => pm.response.to.have.status(201));
        const d = pm.response.json().data;
        pm.test('Bonnes réponses jamais envoyées', () => d.questions.forEach((q) => pm.expect(q).to.not.have.property('correctIndex')));
        pm.test('Échéance côté serveur', () => pm.expect(new Date(d.attempt.deadlineAt).getTime()).to.be.above(Date.now()));
        pm.environment.set('attemptId', d.attempt.id);
        pm.environment.set('quizQuestions', JSON.stringify(d.questions.map((q) => q.id)));
      } }),
      req('Envoyer les réponses', 'POST', '/api/quiz-attempts/{{attemptId}}/submit', {
        prerequest: () => {
          const ids = JSON.parse(pm.environment.get('quizQuestions'));
          pm.environment.set('quizAnswers', JSON.stringify(ids.map((id, i) => ({ questionId: id, selectedIndex: i % 2, timeMs: 9000 }))));
        },
        body: { answers: '{{quizAnswers}}' },
        test: () => {
          pm.test('Statut 200', () => pm.response.to.have.status(200));
          const d = pm.response.json().data;
          pm.test('Score et score par compétence', () => { pm.expect(d.attempt.percent).to.be.within(0, 100); pm.expect(d.attempt.perSkill.length).to.be.above(0); });
          pm.test('Correction avec explications', () => pm.expect(d.correction[0]).to.include.keys('correctIndex', 'selectedIndex', 'explanation'));
        },
      }),
      req('Renvoyer le quiz (409)', 'POST', '/api/quiz-attempts/{{attemptId}}/submit', { body: { answers: [] }, test: expectCode(409, 'ATTEMPT_CLOSED') }),
      req('Recommencer : plus de tentative (409)', 'POST', '/api/applications/{{applicationId}}/quiz/start', { test: () => pm.test('Statut 409', () => pm.response.to.have.status(409)) }),
      req('Statistiques des quiz', 'GET', '/api/quizzes/stats', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Totaux, distribution, compétences, mois', () => pm.expect(d).to.include.keys('totals', 'scoreDistribution', 'perSkill', 'perQuiz', 'perMonth', 'byMetier'));
        pm.test('Au moins un passage', () => pm.expect(d.totals.attempts).to.be.above(0));
      } }),
    ]),

    folder('06 · Entretien avec l\'avatar (entité 2)', 'Démarrage, réponses texte + audio (Whisper), fin, évaluation, décision', [
      req('Entretien (vue candidat : sans grille)', 'GET', '/api/interviews/{{interviewId}}', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Planifié', () => pm.expect(pm.response.json().data.status).to.eql('planifie'));
      } }),
      req('Démarrer l\'entretien (questions construites pour ce candidat)', 'POST', '/api/interviews/{{interviewId}}/start', { body: { language: 'fr' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const q = pm.response.json().data.interview.questions;
        pm.test('5 questions : présentation, 2 techniques, situation, motivation', () => pm.expect(q.map((x) => x.type)).to.eql(['presentation', 'technique', 'technique', 'situation', 'motivation']));
        pm.test('Grilles d\'attendus cachées au candidat', () => q.forEach((x) => pm.expect(x).to.not.have.property('keyPoints')));
      } }),
      req('Réponse 1 : AUDIO (WAV, transcrit par Whisper)', 'POST', '/api/interviews/{{interviewId}}/answers', {
        body: { questionIndex: 0, audioFileName: 'reponse_presentation_fr.wav', audioBase64: '{{audioBase64}}' },
        test: () => { pm.test('Statut 202 (analyse en arrière-plan)', () => pm.response.to.have.status(202)); },
      }),
      req('Réponse 1 en double (409)', 'POST', '/api/interviews/{{interviewId}}/answers', { body: { questionIndex: 0, transcript: 'doublon' }, test: expectCode(409, 'ALREADY_ANSWERED') }),
      req('Réponse 2 (texte)', 'POST', '/api/interviews/{{interviewId}}/answers', { body: { questionIndex: 1, transcript: 'Je garde l\'état local avec useState, je le remonte ou j\'utilise un contexte quand plusieurs composants le partagent, et React Query pour les données du serveur. J\'évite les rendus inutiles avec la mémoïsation.' }, test: expect(202) }),
      req('Réponse 3 (texte)', 'POST', '/api/interviews/{{interviewId}}/answers', { body: { questionIndex: 2, transcript: 'Je mesure d\'abord avec explain pour trouver la requête lente, j\'ajoute un index sur les champs filtrés, je limite les données avec une projection et la pagination, puis je vérifie le gain obtenu.' }, test: expect(202) }),
      req('Réponse 4 (texte)', 'POST', '/api/interviews/{{interviewId}}/answers', { body: { questionIndex: 3, transcript: 'Dans un projet de fin d\'études, deux membres de l\'équipe n\'étaient pas d\'accord sur l\'architecture. J\'ai organisé une réunion, chacun a présenté ses arguments, nous avons fait un prototype et choisi ensemble. Le projet a été livré à temps et j\'ai appris à faciliter les échanges.' }, test: expect(202) }),
      req('Réponse 5 (texte)', 'POST', '/api/interviews/{{interviewId}}/answers', { body: { questionIndex: 4, transcript: 'Votre mission dans le recrutement m\'attire, le poste correspond à mes compétences, et dans deux ans je me vois prendre des responsabilités techniques en continuant d\'apprendre.' }, test: expect(202) }),
      req('Question inexistante (422)', 'POST', '/api/interviews/{{interviewId}}/answers', { body: { questionIndex: 9, transcript: 'hors limites' }, test: () => pm.test('Statut 422', () => pm.response.to.have.status(422)) }),
      req('Terminer l\'entretien', 'POST', '/api/interviews/{{interviewId}}/finish', { test: expect(202) }),
      req('Attendre l\'évaluation (Whisper + notation + synthèse)', 'GET', '/api/interviews/{{interviewId}}', {
        prerequest: () => { if (pm.environment.get('pollCount')) setTimeout(() => {}, 4000); },
        test: () => {
          const d = pm.response.json().data;
          const n = Number(pm.environment.get('pollCount') || 0);
          if (d.status !== 'evalue' && n < 60) {
            pm.environment.set('pollCount', n + 1);
            postman.setNextRequest(pm.info.requestName);
            return;
          }
          pm.environment.unset('pollCount');
          pm.test('Entretien évalué', () => pm.expect(d.status).to.eql('evalue'));
          pm.test('Note globale + composantes', () => pm.expect(d.evaluation).to.include.keys('overall', 'technical', 'communication', 'motivation', 'quiz', 'recommendation', 'summary'));
          const audio = d.answers.find((a) => a.questionIndex === 0);
          pm.test('Réponse audio transcrite par Whisper (français détecté)', () => { pm.expect(audio.inputMode).to.eql('voix'); pm.expect(audio.transcript.length).to.be.above(20); pm.expect(audio.detectedLanguage).to.eql('fr'); });
          pm.test('5 réponses notées avec retour', () => { pm.expect(d.answers).to.have.length(5); d.answers.forEach((a) => pm.expect(a.feedback).to.be.a('string')); });
          pm.test('Grilles visibles après l\'évaluation', () => pm.expect(d.questions[1].keyPoints.length).to.be.above(2));
        },
      }),
      req('E-mail « entretien évalué » au recruteur', 'GET', '/api/test-mails', { auth: null, prerequest: () => {
        if (pm.environment.get('mailCapture') !== 'true') pm.execution.skipRequest();
      }, test: () => pm.test('E-mail envoyé', () => pm.expect(pm.response.json().data.some((m) => m.template === 'interviewDone')).to.eql(true)) }),
    ]),

    folder('07 · Entretiens — CRUD recruteur (entité 2)', 'Liste, recherche, filtres, tri, pagination, lecture, modification, décision, statistiques, création, suppression', [
      req('Lister : recherche par candidat', 'GET', '/api/interviews?q=postman&sort=-scheduledAt', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Trouvé', () => pm.expect(pm.response.json().data.items.map((x) => x.id)).to.include(pm.environment.get('interviewId')));
      } }),
      req('Filtrer : évalués, note ≥ 0, tri note décroissante, page 1', 'GET', '/api/interviews?status=evalue&minScore=0&sort=-evaluation.overall&page=1&limit=3', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const items = pm.response.json().data.items;
        const s = items.map((x) => x.evaluation.overall);
        pm.test('Tous évalués, notes décroissantes', () => { items.forEach((x) => pm.expect(x.status).to.eql('evalue')); pm.expect(s).to.eql([...s].sort((a, b) => b - a)); });
        pm.test('3 au maximum', () => pm.expect(items.length).to.be.at.most(3));
      } }),
      req('Pagination des entretiens : page 2 (limit=2)', 'GET', '/api/interviews?sort=candidateName&page=2&limit=2', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const p = pm.response.json().data.pagination;
        pm.test('Page 2, cohérence total / pages', () => { pm.expect(p.page).to.eql(2); pm.expect(p.hasPrev).to.eql(true); pm.expect(p.pages).to.eql(Math.max(1, Math.ceil(p.total / 2))); });
        const names = pm.response.json().data.items.map((x) => x.candidateName);
        pm.test('Tri par nom de candidat', () => pm.expect(names).to.eql([...names].sort()));
      } }),
      req('Filtrer par plage de dates (créneau)', 'GET', '/api/interviews?from=2020-01-01T00:00:00.000Z&to=2099-01-01T00:00:00.000Z&limit=5', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Créneaux dans la plage', () => pm.response.json().data.items.forEach((x) => pm.expect(new Date(x.scheduledAt).getFullYear()).to.be.within(2020, 2099)));
      } }),
      req('Filtrer : recommandation + langue', 'GET', '/api/interviews?recommendation=recommande&language=fr', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.response.json().data.items.forEach((x) => pm.test(`${x.candidateName} recommandé`, () => pm.expect(x.evaluation.recommendation).to.eql('recommande')));
      } }),
      req('Lire (vue recruteur : grilles et transcriptions)', 'GET', '/api/interviews/{{interviewId}}', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Grille d\'attendus et points couverts', () => { pm.expect(pm.response.json().data.questions[0].keyPoints.length).to.be.above(0); pm.expect(pm.response.json().data.answers[0]).to.have.property('coveredPoints'); });
      } }),
      req('Modifier : notes du recruteur', 'PATCH', '/api/interviews/{{interviewId}}', { auth: '{{tokenRecruteur}}', body: { recruiterNotes: 'Bonne maîtrise de React, à revoir sur MongoDB.' }, test: expect(200) }),
      req('Modifier un champ verrouillé après l\'entretien (409)', 'PATCH', '/api/interviews/{{interviewId}}', { auth: '{{tokenRecruteur}}', body: { language: 'en' }, test: expectCode(409, 'INTERVIEW_LOCKED') }),
      req('Décision : retenu (e-mail au candidat)', 'POST', '/api/interviews/{{interviewId}}/decision', { auth: '{{tokenRecruteur}}', body: { value: 'retenu', comment: 'Très bon entretien, nous vous recontactons.' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Décision enregistrée', () => pm.expect(pm.response.json().data.decision.value).to.eql('retenu'));
      } }),
      req('Candidature retenue (vue candidat)', 'GET', '/api/applications/{{applicationId}}', { test: () => pm.test('Statut retenue', () => pm.expect(pm.response.json().data.status).to.eql('retenue')) }),
      req('Statistiques des entretiens', 'GET', '/api/interviews/stats', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Indicateurs complets', () => pm.expect(d).to.include.keys('totals', 'byStatus', 'byRecommendation', 'byDecision', 'byLanguage', 'byMetier', 'perQuestionType', 'perMonth', 'scoreDistribution'));
        pm.test('Au moins un entretien évalué', () => pm.expect(d.totals.evaluated).to.be.above(0));
      } }),
      req('Statistiques filtrées par métier', 'GET', '/api/interviews/stats?metier=dev-fullstack', { auth: '{{tokenRecruteur}}', test: expect(200) }),
      req('Préparer : 2e candidature (sous le seuil)', 'POST', '/api/applications', {
        prerequest: () => {},
        body: { jobId: '{{jobDevopsId}}', cvBase64: '{{cvBase64}}' },
        test: () => {
          pm.test('Statut 201', () => pm.response.to.have.status(201));
          pm.environment.set('application2Id', pm.response.json().data.id);
          pm.test('Refusée (DevOps exige 3 ans et Kubernetes)', () => pm.expect(pm.response.json().data.status).to.eql('refusee'));
        },
      }),
      req('Créer un entretien manuellement (recruteur)', 'POST', '/api/interviews', { auth: '{{tokenRecruteur}}', body: { application: '{{application2Id}}', language: 'en' }, test: () => {
        pm.test('Statut 201', () => pm.response.to.have.status(201));
        pm.test('Planifié en anglais', () => { pm.expect(pm.response.json().data.status).to.eql('planifie'); pm.expect(pm.response.json().data.language).to.eql('en'); });
        pm.environment.set('interview2Id', pm.response.json().data.id);
      } }),
      req('Créer en double (409)', 'POST', '/api/interviews', { auth: '{{tokenRecruteur}}', body: { application: '{{application2Id}}' }, test: expectCode(409, 'INTERVIEW_EXISTS') }),
      req('Modifier le créneau et la langue', 'PATCH', '/api/interviews/{{interview2Id}}', {
        auth: '{{tokenRecruteur}}',
        prerequest: () => {
          pm.environment.set('slot', new Date(Date.now() + 2 * 86400000).toISOString());
          pm.environment.set('limit', new Date(Date.now() + 9 * 86400000).toISOString());
        },
        body: { scheduledAt: '{{slot}}', expiresAt: '{{limit}}', language: 'fr', avatar: { name: 'Nora', voice: 'feminine' } },
        test: () => { pm.test('Statut 200', () => pm.response.to.have.status(200)); pm.test('Langue fr', () => pm.expect(pm.response.json().data.language).to.eql('fr')); },
      }),
      req('Annuler l\'entretien', 'PATCH', '/api/interviews/{{interview2Id}}', { auth: '{{tokenRecruteur}}', body: { status: 'annule' }, test: () => pm.test('Annulé', () => pm.expect(pm.response.json().data.status).to.eql('annule')) }),
      req('Supprimer l\'entretien', 'DELETE', '/api/interviews/{{interview2Id}}', { auth: '{{tokenRecruteur}}', test: expect(200) }),
      req('Lire l\'entretien supprimé (404)', 'GET', '/api/interviews/{{interview2Id}}', { auth: '{{tokenRecruteur}}', test: expectCode(404, 'INTERVIEW_NOT_FOUND') }),
      req('Supprimer un quiz déjà passé (409 : archiver)', 'DELETE', '/api/quizzes/{{usedQuizId}}', {
        auth: '{{tokenRecruteur}}',
        prerequest: () => {},
        test: expectCode(409, 'QUIZ_HAS_ATTEMPTS'),
      }),
    ]),

    folder('08 · Chatbot (agent RAG + outils)', 'Questions sur la candidature, entraînement', [
      req('Question d\'entraînement', 'GET', '/api/chatbot/practice?metier=data-scientist', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.environment.set('practiceQuestion', pm.response.json().data.question);
      } }),
      req('Évaluer une réponse d\'entraînement', 'POST', '/api/chatbot/practice/evaluate', { body: { question: '{{practiceQuestion}}', answer: 'Je clarifie le besoin et la métrique, je nettoie et explore les données, je sépare entraînement et test avec validation croisée, je compare plusieurs modèles puis je déploie et je surveille la dérive.' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Note et conseil', () => { pm.expect(pm.response.json().data.note).to.be.within(0, 100); pm.expect(pm.response.json().data.conseil).to.be.a('string'); });
      } }),
      req('Message : « Où en est ma candidature ? »', 'POST', '/api/chatbot/message', { body: { message: 'Où en est ma candidature et quelle est ma note d\'entretien ?' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Réponse + sources (RAG)', () => { pm.expect(d.answer.length).to.be.above(10); pm.expect(d.sources.length).to.be.above(0); });
        pm.test('Mode agent (outils) ou extractif', () => pm.expect(['agent', 'extractif']).to.include(d.mode));
      } }),
      req('Message vide (422)', 'POST', '/api/chatbot/message', { body: { message: '' }, test: () => pm.test('Statut 422', () => pm.response.to.have.status(422)) }),
    ]),

    folder('09 · Tableau de bord et administration', 'Statistiques globales, modèles IA, utilisateurs', [
      req('Tableau de bord (entonnoir)', 'GET', '/api/stats/overview', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Entonnoir en 5 étapes', () => pm.expect(pm.response.json().data.funnel).to.have.length(5));
      } }),
      req('État des modèles IA', 'GET', '/api/system/ai', { auth: '{{tokenRecruteur}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Whisper et MiniLM listés', () => pm.expect(pm.response.json().data.huggingFace.map((m) => m.key)).to.include.members(['embeddings', 'whisper']));
      } }),
      req('Utilisateurs : filtre rôle candidat, tri nom', 'GET', '/api/users?role=candidat&sort=lastName&limit=5', { auth: '{{tokenAdmin}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Candidats seulement', () => pm.response.json().data.items.forEach((u) => pm.expect(u.role).to.eql('candidat')));
      } }),
      req('Utilisateurs : recruteur interdit (403)', 'GET', '/api/users', { auth: '{{tokenRecruteur}}', test: expectCode(403, 'FORBIDDEN') }),
      req('Créer un recruteur', 'POST', '/api/users', {
        auth: '{{tokenAdmin}}',
        prerequest: () => {
          pm.environment.set('newRhEmail', `raifguizani10+postman-rh${Date.now()}@gmail.com`);
        },
        body: { firstName: 'Rh', lastName: 'Postman', email: '{{newRhEmail}}', password: 'Recruteur@2026', role: 'recruteur' },
        test: () => { pm.test('Statut 201', () => pm.response.to.have.status(201)); pm.environment.set('newUserId', pm.response.json().data.id); },
      }),
      req('Bloquer le recruteur', 'PATCH', '/api/users/{{newUserId}}', { auth: '{{tokenAdmin}}', body: { isBlocked: true }, test: () => pm.test('Bloqué', () => pm.expect(pm.response.json().data.isBlocked).to.eql(true)) }),
      req('Connexion d\'un compte bloqué (403)', 'POST', '/api/auth/login', { auth: null, body: { email: '{{newRhEmail}}', password: 'Recruteur@2026' }, test: expectCode(403, 'ACCOUNT_BLOCKED') }),
      req('Supprimer le recruteur', 'DELETE', '/api/users/{{newUserId}}', { auth: '{{tokenAdmin}}', test: expect(200) }),
      req('Déconnexion du candidat', 'POST', '/api/auth/logout', { test: expect(200) }),
      req('Route inconnue (404)', 'GET', '/api/inexistante', { auth: null, test: expectCode(404, 'NOT_FOUND') }),
    ]),

    folder('10 · E-mails réels', 'Chaque e-mail du parcours a été remis au serveur SMTP (Gmail) : accusé et identifiant de message', [
      req('Tous les e-mails remis par SMTP (accusé Gmail)', 'GET', '/api/test-mails', { auth: null, prerequest: () => {
        if (pm.environment.get('mailCapture') !== 'true') pm.execution.skipRequest();
        setTimeout(() => {}, 10000); // laisse finir les derniers envois SMTP (en arrière-plan)
      }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const mails = pm.response.json().data;
        const real = mails.filter((m) => m.delivery);
        if (!real.length) {
          pm.test('Mode capture (--emails-captures) : remise SMTP non vérifiée', () => pm.expect(mails.length).to.be.above(0));
          return;
        }
        pm.test('Au moins 5 e-mails envoyés pendant le parcours', () => pm.expect(real.length).to.be.at.least(5));
        pm.test('Tous remis au serveur SMTP (messageId + destinataire accepté)', () => real.forEach((m) => {
          pm.expect(m.delivery, `${m.template} → ${m.to} : ${m.lastError || ''}`).to.eql('envoye');
          pm.expect(m.messageId).to.be.a('string');
          pm.expect(m.accepted).to.include(m.deliveredTo || m.to);
        }));
        console.log(real.map((m) => `${m.template} → ${m.to} : ${m.smtpResponse}`).join(' | '));
      } }),
    ]),
  ],
};


// Identifiants qui dépendent des données : récupérés dans les dossiers avant usage.
// Offre DevOps (pour la 2e candidature) et quiz du métier déjà passé (pour le 409).
const crudItv = collection.item[7].item;
const idx = crudItv.findIndex((r) => r.name.startsWith('Supprimer un quiz déjà passé'));
crudItv.splice(idx, 0, req('Quiz attribué à ma candidature', 'GET', '/api/applications/{{applicationId}}', { test: () => {
  pm.test('Statut 200', () => pm.response.to.have.status(200));
  pm.environment.set('usedQuizId', pm.response.json().data.quiz.id || pm.response.json().data.quiz._id);
} }));

// Corps « answers » injecté brut (tableau JSON) à partir de la variable.
const submit = collection.item[5].item.find((r) => r.name === 'Envoyer les réponses');
submit.request.body.raw = '{\n  "answers": {{quizAnswers}}\n}';

const environment = (name, baseUrl) => ({
  name,
  values: [
    ['baseUrl', baseUrl], ['adminEmail', 'raifguizani10+live-admin@gmail.com'], ['adminPassword', 'Admin@2026'],
    ['recruteurEmail', 'raifguizani10+live-rh@gmail.com'], ['recruteurPassword', 'Recruteur@2026'],
    ['cvBase64', fs.readFileSync(path.join(HERE, 'fichiers', 'CV_Postman.pdf')).toString('base64')],
    ['audioBase64', fs.readFileSync(path.join(HERE, 'fichiers', 'reponse_presentation_fr.wav')).toString('base64')],
    ['mailCapture', 'true'],
  ].map(([key, value]) => ({ key, value, type: 'default', enabled: true })),
  _postman_variable_scope: 'environment',
});

// Garde-fou : sans environnement sélectionné, {{baseUrl}} est vide et AUCUNE requête ne part (« Request could not
// be sent »). baseUrl existe donc aussi en variable de collection : la 1re requête part, constate l'absence
// d'environnement, l'explique et arrête le passage. Toutes les autres valeurs restent dans l'environnement.
collection.variable = [{ key: 'baseUrl', value: 'http://localhost:8201', type: 'string' }];
const firstTest = collection.item[0].item[0].event.find((e) => e.listen === 'test');
firstTest.script.exec.unshift(...tests(() => {
  const ok = !!pm.environment.name && !!pm.environment.get('adminEmail');
  pm.test('Environnement « TalentWave Live (test, port 8201) » sélectionné', () => pm.expect(ok, 'Choisissez l’environnement « TalentWave Live (test, port 8201) » en haut à droite de Postman, puis relancez').to.eql(true));
  if (!ok) pm.execution.setNextRequest(null);
})[0].script.exec);

// Réponses réelles du dernier passage Newman (exemples-reponses.json) attachées comme « Examples ».
const withExamples = require('./examples').apply(collection);
fs.writeFileSync(path.join(HERE, 'TalentWave-Live.postman_collection.json'), JSON.stringify(collection, null, 2));
fs.writeFileSync(path.join(HERE, 'TalentWave-Live-test.postman_environment.json'), JSON.stringify(environment('TalentWave Live (test, port 8201)', 'http://localhost:8201'), null, 2));
const count = collection.item.reduce((a, f) => a + f.item.length, 0);
if (require.main === module) console.log(`Collection générée : ${collection.item.length} dossiers, ${count} requêtes, ${withExamples} réponses réelles en exemple.`);
module.exports = { count, withExamples };
