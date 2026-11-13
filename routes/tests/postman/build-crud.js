/**
 * Collection Postman « CRUD » : les 2 entités métier (Quiz, Entretiens) avec Create / Read / Update / Delete,
 * recherche, filtres, tri, pagination et statistiques. À importer dans l'APPLICATION Postman (un seul fichier).
 *
 *   node routes/tests/postman/build-crud.js     → TalentWave-Live-CRUD.postman_collection.json
 *
 * - Aucun environnement nécessaire : variables de COLLECTION (crudUrl = http://localhost:8200, le serveur de dev).
 *   Noms propres à cette collection (crud…) : un ancien environnement sélectionné ne peut pas les masquer.
 * - Rejouable autant de fois que voulu : chaque passage crée ses propres données puis les supprime
 *   (quiz créé → supprimé ; nouveau candidat qui postule → entretien créé par le recruteur → supprimé).
 * - Aucun test sur l'IA (testée à part) : la candidature de préparation sert seulement à pouvoir créer un entretien.
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const OUT = path.join(HERE, 'TalentWave-Live-CRUD.postman_collection.json');
const EXAMPLES = path.join(HERE, 'exemples-crud.json');

const script = (fn) => fn.toString().replace(/^[^{]*{\s*\n?/, '').replace(/\s*}\s*$/, '').split('\n').map((l) => l.replace(/^ {4}/, ''));
const ev = (listen, fn) => ({ listen, script: { type: 'text/javascript', exec: script(fn) } });

function req(name, method, url, { body, auth = '{{crudTokenRecruteur}}', test, prerequest, description } = {}) {
  const [p, qs] = url.split('?');
  const request = {
    method,
    header: [],
    url: {
      raw: `{{crudUrl}}${url}`,
      host: ['{{crudUrl}}'],
      path: p.split('/').filter(Boolean),
      ...(qs ? { query: qs.split('&').map((kv) => { const [key, value = ''] = kv.split('='); return { key, value }; }) } : {}),
    },
    auth: auth ? { type: 'bearer', bearer: [{ key: 'token', value: auth, type: 'string' }] } : { type: 'noauth' },
  };
  if (description) request.description = description;
  if (body) {
    request.header.push({ key: 'Content-Type', value: 'application/json' });
    request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } };
  }
  const event = [];
  if (prerequest) event.push(ev('prerequest', prerequest));
  if (test) event.push(ev('test', test));
  return { name, event, request };
}
const folder = (name, description, item) => ({ name, description, item });
const status = (code) => new Function(`pm.test('Statut ${code}', () => pm.response.to.have.status(${code}));`);

const collection = {
  info: {
    name: 'TalentWave Live — CRUD Quiz & Entretiens + Chatbot + Entretien',
    description: [
      'CRUD complet des 2 entités (Quiz, Entretiens) + recherche, filtres, tri, pagination, statistiques, et le chatbot du candidat.',
      '',
      '1. Démarrer l\'application (npm run dev ou INSTALLER_ET_LANCER.bat) : API sur http://localhost:8200.',
      '2. Environnement : « No Environment » (rien à configurer, tout est dans les variables de la collection).',
      '3. Clic droit sur la collection > Run collection > Run (dans l\'ordre). Ou requête par requête, de haut en bas.',
      '',
      'Rejouable : chaque passage crée ses données (quiz, candidat, candidature, entretien) puis supprime le quiz et l\'entretien.',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'crudUrl', value: 'http://localhost:8200' },
    { key: 'crudRecruteurEmail', value: 'raifguizani10+live-rh@gmail.com' },
    { key: 'crudRecruteurPassword', value: 'Recruteur@2026' },
    { key: 'crudCandidatDemoEmail', value: 'raifguizani10+live-candidat1@gmail.com' },
    { key: 'crudCandidatDemoPassword', value: 'Candidat@2026' },
    { key: 'crudCvBase64', value: fs.readFileSync(path.join(HERE, 'fichiers', 'CV_Postman.pdf')).toString('base64') },
    { key: 'procAudioBase64', value: fs.readFileSync(path.join(HERE, 'fichiers', 'reponse_presentation_fr.wav')).toString('base64') },
  ].map((v) => ({ ...v, type: 'string' })),
  item: [
    folder('0 · Connexion', 'Jeton du recruteur, enregistré dans la collection', [
      req('Connexion recruteur', 'POST', '/api/auth/login', {
        auth: null,
        body: { email: '{{crudRecruteurEmail}}', password: '{{crudRecruteurPassword}}' },
        test: () => {
          pm.test('Statut 200', () => pm.response.to.have.status(200));
          const d = pm.response.json().data;
          pm.test('Rôle recruteur', () => pm.expect(d.user.role).to.eql('recruteur'));
          pm.collectionVariables.set('crudTokenRecruteur', d.accessToken);
        },
      }),
    ]),

    folder('1 · Quiz — CRUD (entité 1)', 'Créer, lire, lister (pagination, recherche, filtres, tri), statistiques, modifier, supprimer', [
      req('CREATE — Créer un quiz', 'POST', '/api/quizzes', {
        body: {
          title: 'Quiz CRUD Postman — React & API', metier: 'dev-fullstack', description: 'Quiz créé depuis l\'application Postman',
          durationMinutes: 6, passingScore: 50, questionsPerAttempt: 3, language: 'fr', difficulty: 'moyen', status: 'inactif',
          questions: [
            { text: 'Quel hook React exécute un effet après le rendu ?', options: ['useMemo', 'useEffect', 'useRef', 'useId'], correctIndex: 1, skill: 'React', explanation: 'useEffect s\'exécute après le rendu.' },
            { text: 'Quel code HTTP pour une création réussie ?', options: ['200', '201', '204', '404'], correctIndex: 1, skill: 'API REST' },
            { text: 'Quelle commande Git rejoue des commits sur une autre base ?', options: ['merge', 'rebase', 'stash', 'tag'], correctIndex: 1, skill: 'Git', points: 2, difficulty: 'difficile' },
          ],
        },
        test: () => {
          pm.test('Statut 201', () => pm.response.to.have.status(201));
          const d = pm.response.json().data;
          pm.test('3 questions, compétences calculées', () => { pm.expect(d.questionCount).to.eql(3); pm.expect(d.skills).to.include.members(['React', 'API REST', 'Git']); });
          pm.collectionVariables.set('crudQuizId', d.id);
        },
      }),
      req('CREATE — Données invalides refusées (422)', 'POST', '/api/quizzes', {
        body: { title: 'Q', metier: 'dev-fullstack', questions: [{ text: 'Bonne réponse hors des choix ?', options: ['A', 'B'], correctIndex: 5, skill: 'React' }] },
        test: () => {
          pm.test('Statut 422', () => pm.response.to.have.status(422));
          pm.test('Erreurs par champ', () => pm.expect(pm.response.json().errors.length).to.be.above(0));
        },
      }),
      req('READ — Lire le quiz créé', 'GET', '/api/quizzes/{{crudQuizId}}', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Titre et questions', () => { pm.expect(d.title).to.include('CRUD Postman'); pm.expect(d.questions).to.have.length(3); });
        pm.test('Bonnes réponses visibles pour le recruteur', () => pm.expect(d.questions[0]).to.have.property('correctIndex'));
      } }),
      req('LIST — Pagination page 1 (2 par page)', 'GET', '/api/quizzes?sort=title&page=1&limit=2', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('2 éléments max, page 1', () => { pm.expect(d.items.length).to.be.at.most(2); pm.expect(d.pagination.page).to.eql(1); });
        pm.test('Total et nombre de pages', () => { pm.expect(d.pagination.total).to.be.above(2); pm.expect(d.pagination.pages).to.eql(Math.ceil(d.pagination.total / 2)); });
        pm.collectionVariables.set('crudPage1First', d.items[0].id);
      } }),
      req('LIST — Pagination page 2', 'GET', '/api/quizzes?sort=title&page=2&limit=2', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Page 2', () => pm.expect(d.pagination.page).to.eql(2));
        pm.test('Éléments différents de la page 1', () => pm.expect(d.items.map((x) => x.id)).to.not.include(pm.collectionVariables.get('crudPage1First')));
      } }),
      req('SEARCH — Recherche « crud postman » (insensible à la casse et aux accents)', 'GET', '/api/quizzes?q=CRUD%20POSTMAN', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Quiz créé trouvé', () => pm.expect(pm.response.json().data.items.map((x) => x.id)).to.include(pm.collectionVariables.get('crudQuizId')));
      } }),
      req('FILTER — Métier + statut + difficulté', 'GET', '/api/quizzes?metier=dev-fullstack&status=inactif&difficulty=moyen', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const items = pm.response.json().data.items;
        pm.test('Tous respectent les 3 filtres', () => items.forEach((x) => { pm.expect(x.metier).to.eql('dev-fullstack'); pm.expect(x.status).to.eql('inactif'); pm.expect(x.difficulty).to.eql('moyen'); }));
        pm.test('Le quiz créé en fait partie', () => pm.expect(items.map((x) => x.id)).to.include(pm.collectionVariables.get('crudQuizId')));
      } }),
      req('SORT — Tri par durée décroissante', 'GET', '/api/quizzes?sort=-durationMinutes&limit=50', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data.items.map((x) => x.durationMinutes);
        pm.test('Durées décroissantes', () => d.forEach((v, i) => i && pm.expect(v).to.be.at.most(d[i - 1])));
      } }),
      req('SORT — Tri par titre croissant', 'GET', '/api/quizzes?sort=title&limit=50', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const t = pm.response.json().data.items.map((x) => x.title.toLowerCase());
        pm.test('Titres dans l\'ordre alphabétique', () => t.forEach((v, i) => i && pm.expect(v.localeCompare(t[i - 1], 'fr')).to.be.at.least(0)));
      } }),
      req('STATS — Statistiques des quiz', 'GET', '/api/quizzes/stats', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Totaux, répartitions et passages', () => pm.expect(d).to.be.an('object').that.is.not.empty);
        console.log(JSON.stringify(d).slice(0, 800));
      } }),
      req('UPDATE — Modifier (seuil, durée, statut actif)', 'PATCH', '/api/quizzes/{{crudQuizId}}', { body: { passingScore: 60, durationMinutes: 8, status: 'actif' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Modifications enregistrées', () => { pm.expect(d.passingScore).to.eql(60); pm.expect(d.durationMinutes).to.eql(8); pm.expect(d.status).to.eql('actif'); });
      } }),
      req('READ — Relire après modification', 'GET', '/api/quizzes/{{crudQuizId}}', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Valeurs persistées en base', () => { pm.expect(pm.response.json().data.passingScore).to.eql(60); pm.expect(pm.response.json().data.status).to.eql('actif'); });
      } }),
      req('DELETE — Supprimer le quiz', 'DELETE', '/api/quizzes/{{crudQuizId}}', { test: status(200) }),
      req('READ — Quiz supprimé introuvable (404)', 'GET', '/api/quizzes/{{crudQuizId}}', { test: status(404) }),
    ]),

    folder('2 · Entretiens — CRUD (entité 2)', 'Préparation (candidature réelle), puis créer, lire, lister (pagination, recherche, filtres, tri), statistiques, modifier, supprimer', [
      req('Préparation — Inscription d\'un candidat', 'POST', '/api/auth/signup', {
        auth: null,
        prerequest: () => {
          const n = Date.now();
          pm.collectionVariables.set('crudCandidatEmail', `raifguizani10+crud${n}@gmail.com`);
          pm.collectionVariables.set('crudCandidatNom', `Crud${String(n).slice(-6)}`);
        },
        body: { firstName: 'Postman', lastName: '{{crudCandidatNom}}', email: '{{crudCandidatEmail}}', password: 'Candidat@2026', preferredLanguage: 'fr' },
        test: () => {
          pm.test('Statut 201', () => pm.response.to.have.status(201));
          pm.collectionVariables.set('crudTokenCandidat', pm.response.json().data.accessToken);
        },
      }),
      req('Préparation — Offre « Comptabilité » publiée', 'GET', '/api/jobs?metier=comptable&limit=1', { auth: null, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const job = pm.response.json().data.items[0];
        pm.test('Offre trouvée', () => pm.expect(job).to.be.an('object'));
        pm.collectionVariables.set('crudJobId', job.id);
      } }),
      req('Préparation — Le candidat postule avec son CV PDF', 'POST', '/api/applications', {
        auth: '{{crudTokenCandidat}}',
        body: { jobId: '{{crudJobId}}', coverLetter: 'Candidature de test CRUD depuis Postman.', cvFileName: 'CV_Postman.pdf', cvBase64: '{{crudCvBase64}}' },
        test: () => {
          pm.test('Statut 201', () => pm.response.to.have.status(201));
          const d = pm.response.json().data;
          pm.collectionVariables.set('crudApplicationId', d.id);
          pm.collectionVariables.set('crudAutoInterviewId', (d.interview && (d.interview.id || d.interview._id)) || '');
        },
      }),
      req('Préparation — Libérer la candidature si l\'IA a déjà invité le candidat', 'DELETE', '/api/interviews/{{crudAutoInterviewId}}', {
        prerequest: () => { if (!pm.collectionVariables.get('crudAutoInterviewId')) pm.execution.skipRequest(); },
        test: status(200),
      }),
      req('CREATE — Créer l\'entretien (recruteur)', 'POST', '/api/interviews', {
        prerequest: () => {
          const d = new Date(Date.now() + 2 * 86400000); d.setUTCHours(9, 0, 0, 0);
          pm.collectionVariables.set('crudScheduledAt', d.toISOString());
        },
        body: { application: '{{crudApplicationId}}', scheduledAt: '{{crudScheduledAt}}', language: 'fr', durationMinutes: 5, recruiterNotes: 'Créé depuis Postman (CRUD)' },
        test: () => {
          pm.test('Statut 201', () => pm.response.to.have.status(201));
          const d = pm.response.json().data;
          pm.test('Planifié, créneau et lien de visio réel (questions préparées au démarrage, selon le quiz)', () => { pm.expect(d.status).to.eql('planifie'); pm.expect(d.scheduledAt).to.eql(pm.collectionVariables.get('crudScheduledAt')); pm.expect(d.meet.link).to.match(/^https:\/\/(meet\.google\.com|meet\.jit\.si)\//); });
          pm.collectionVariables.set('crudInterviewId', d.id);
        },
      }),
      req('CREATE — Doublon refusé (409)', 'POST', '/api/interviews', { body: { application: '{{crudApplicationId}}' }, test: () => {
        pm.test('Statut 409', () => pm.response.to.have.status(409));
        pm.test('Code INTERVIEW_EXISTS', () => pm.expect(pm.response.json().code).to.eql('INTERVIEW_EXISTS'));
      } }),
      req('READ — Lire l\'entretien créé', 'GET', '/api/interviews/{{crudInterviewId}}', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Candidat, poste, créneau', () => { pm.expect(d.candidateName).to.include(pm.collectionVariables.get('crudCandidatNom')); pm.expect(d.title).to.include('Entretien'); pm.expect(d.scheduledAt).to.be.a('string'); });
      } }),
      req('LIST — Pagination page 1 (2 par page)', 'GET', '/api/interviews?sort=-scheduledAt&page=1&limit=2', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('2 éléments max, total et pages', () => { pm.expect(d.items.length).to.be.at.most(2); pm.expect(d.pagination.pages).to.eql(Math.ceil(d.pagination.total / 2)); });
        pm.collectionVariables.set('crudItvPage1First', d.items[0].id);
      } }),
      req('LIST — Pagination page 2', 'GET', '/api/interviews?sort=-scheduledAt&page=2&limit=2', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Page 2, éléments différents', () => { pm.expect(d.pagination.page).to.eql(2); pm.expect(d.items.map((x) => x.id)).to.not.include(pm.collectionVariables.get('crudItvPage1First')); });
      } }),
      req('SEARCH — Recherche par nom du candidat', 'GET', '/api/interviews?q={{crudCandidatNom}}', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Entretien trouvé', () => pm.expect(pm.response.json().data.items.map((x) => x.id)).to.include(pm.collectionVariables.get('crudInterviewId')));
      } }),
      req('FILTER — Statut planifié + métier + langue', 'GET', '/api/interviews?status=planifie&metier=comptable&language=fr', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const items = pm.response.json().data.items;
        pm.test('Tous respectent les filtres', () => items.forEach((x) => { pm.expect(x.status).to.eql('planifie'); pm.expect(x.metier).to.eql('comptable'); pm.expect(x.language).to.eql('fr'); }));
        pm.test('L\'entretien créé en fait partie', () => pm.expect(items.map((x) => x.id)).to.include(pm.collectionVariables.get('crudInterviewId')));
      } }),
      req('FILTER — Entretiens évalués, note ≥ 50', 'GET', '/api/interviews?status=evalue&minScore=50', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Évalués avec note ≥ 50', () => pm.response.json().data.items.forEach((x) => { pm.expect(x.status).to.eql('evalue'); pm.expect(x.evaluation.overall).to.be.at.least(50); }));
      } }),
      req('SORT — Tri par note décroissante', 'GET', '/api/interviews?status=evalue&sort=-evaluation.overall&limit=50', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const n = pm.response.json().data.items.map((x) => x.evaluation.overall);
        pm.test('Notes décroissantes', () => n.forEach((v, i) => i && pm.expect(v).to.be.at.most(n[i - 1])));
      } }),
      req('SORT — Tri par nom du candidat', 'GET', '/api/interviews?sort=candidateName&limit=50', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const t = pm.response.json().data.items.map((x) => x.candidateName.toLowerCase());
        pm.test('Noms dans l\'ordre alphabétique', () => t.forEach((v, i) => i && pm.expect(v.localeCompare(t[i - 1], 'fr')).to.be.at.least(0)));
      } }),
      req('STATS — Statistiques des entretiens', 'GET', '/api/interviews/stats', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Statistiques présentes', () => pm.expect(pm.response.json().data).to.be.an('object').that.is.not.empty);
        console.log(JSON.stringify(pm.response.json().data).slice(0, 800));
      } }),
      req('UPDATE — Modifier (langue, durée, notes du recruteur)', 'PATCH', '/api/interviews/{{crudInterviewId}}', { body: { language: 'en', durationMinutes: 10, recruiterNotes: 'Modifié depuis Postman : entretien en anglais, 10 minutes.' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Modifications enregistrées', () => { pm.expect(d.language).to.eql('en'); pm.expect(d.durationMinutes).to.eql(10); pm.expect(d.recruiterNotes).to.include('Modifié'); });
      } }),
      req('READ — Relire après modification', 'GET', '/api/interviews/{{crudInterviewId}}', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Valeurs persistées en base', () => { pm.expect(pm.response.json().data.language).to.eql('en'); pm.expect(pm.response.json().data.durationMinutes).to.eql(10); });
      } }),
      req('DELETE — Supprimer l\'entretien', 'DELETE', '/api/interviews/{{crudInterviewId}}', { test: status(200) }),
      req('READ — Entretien supprimé introuvable (404)', 'GET', '/api/interviews/{{crudInterviewId}}', { test: status(404) }),
    ]),
    folder('3 · Chatbot', 'Assistant du candidat : questions sur sa candidature (avec sources), entraînement aux questions d\'entretien, historique de conversation', [
      req('Connexion candidat (Amira, candidature existante)', 'POST', '/api/auth/login', {
        auth: null,
        body: { email: '{{crudCandidatDemoEmail}}', password: '{{crudCandidatDemoPassword}}' },
        test: () => {
          pm.test('Statut 200', () => pm.response.to.have.status(200));
          pm.test('Rôle candidat', () => pm.expect(pm.response.json().data.user.role).to.eql('candidat'));
          pm.collectionVariables.set('crudTokenChat', pm.response.json().data.accessToken);
        },
      }),
      req('Message — « Où en est ma candidature ? »', 'POST', '/api/chatbot/message', {
        auth: '{{crudTokenChat}}',
        body: { message: 'Où en est ma candidature et quelle est ma note d\'entretien ?' },
        test: () => {
          pm.test('Statut 200', () => pm.response.to.have.status(200));
          const d = pm.response.json().data;
          pm.test('Réponse rédigée', () => pm.expect(d.answer.length).to.be.above(10));
          pm.test('Sources citées', () => pm.expect(d.sources.length).to.be.above(0));
          pm.test('Mode agent (outils) ou extractif', () => pm.expect(['agent', 'extractif']).to.include(d.mode));
          pm.collectionVariables.set('crudChatAnswer', d.answer);
          console.log(d.answer);
        },
      }),
      req('Message — suite de conversation (historique)', 'POST', '/api/chatbot/message', {
        auth: '{{crudTokenChat}}',
        prerequest: () => {
          pm.collectionVariables.set('crudChatHistory', JSON.stringify([
            { role: 'user', content: 'Où en est ma candidature et quelle est ma note d\'entretien ?' },
            { role: 'assistant', content: pm.collectionVariables.get('crudChatAnswer') || '' },
          ]));
        },
        body: { message: 'Comment me préparer pour la suite ?' },
        test: () => {
          pm.test('Statut 200', () => pm.response.to.have.status(200));
          pm.test('Réponse rédigée', () => pm.expect(pm.response.json().data.answer.length).to.be.above(10));
          console.log(pm.response.json().data.answer);
        },
      }),
      req('Message — question sur le fonctionnement', 'POST', '/api/chatbot/message', {
        auth: '{{crudTokenChat}}',
        body: { message: 'Comment se déroule l\'entretien vidéo avec l\'avatar ?' },
        test: () => {
          pm.test('Statut 200', () => pm.response.to.have.status(200));
          const d = pm.response.json().data;
          pm.test('Réponse + sources', () => { pm.expect(d.answer.length).to.be.above(10); pm.expect(d.sources.length).to.be.above(0); });
        },
      }),
      req('Entraînement — Question d\'entretien du métier', 'GET', '/api/chatbot/practice?metier=dev-fullstack', {
        auth: '{{crudTokenChat}}',
        test: () => {
          pm.test('Statut 200', () => pm.response.to.have.status(200));
          const q = pm.response.json().data.question;
          pm.test('Question reçue', () => pm.expect(q).to.be.a('string').and.not.empty);
          pm.collectionVariables.set('crudPracticeQuestion', q);
        },
      }),
      req('Entraînement — Évaluer ma réponse', 'POST', '/api/chatbot/practice/evaluate', {
        auth: '{{crudTokenChat}}',
        body: { question: '{{crudPracticeQuestion}}', answer: 'Je commence par clarifier le besoin, puis je conçois une API REST avec Node.js et Express, une base MongoDB et une authentification JWT. Côté interface j\'utilise React avec des composants testés. J\'écris des tests, je versionne avec Git et je déploie avec Docker et une intégration continue.' },
        test: () => {
          pm.test('Statut 200', () => pm.response.to.have.status(200));
          const d = pm.response.json().data;
          pm.test('Note 0-100 et conseil', () => { pm.expect(d.note).to.be.within(0, 100); pm.expect(d.conseil).to.be.a('string'); });
          console.log(`Note ${d.note}/100 — ${d.conseil}`);
        },
      }),
      req('Erreur — Message vide (422)', 'POST', '/api/chatbot/message', { auth: '{{crudTokenChat}}', body: { message: '' }, test: status(422) }),
      req('Erreur — Sans connexion (401)', 'POST', '/api/chatbot/message', { auth: null, body: { message: 'Bonjour' }, test: status(401) }),
      req('Erreur — Métier inconnu pour l\'entraînement (422)', 'GET', '/api/chatbot/practice?metier=astronaute', { auth: '{{crudTokenChat}}', test: status(422) }),
    ]),

    folder('4 · Processus d\'entretien', 'Parcours complet d\'un candidat : candidature → invitation → quiz → entretien avec l\'avatar (réponse orale Whisper + réponses écrites) → évaluation → décision du recruteur. Lancer le dossier avec Run : l\'attente de l\'évaluation se répète toute seule.', [
      req('0. Connexion recruteur (pour créer l\'entretien si besoin et décider)', 'POST', '/api/auth/login', {
        auth: null,
        body: { email: '{{crudRecruteurEmail}}', password: '{{crudRecruteurPassword}}' },
        test: () => {
          pm.test('Statut 200', () => pm.response.to.have.status(200));
          pm.collectionVariables.set('crudTokenRecruteur', pm.response.json().data.accessToken);
        },
      }),
      req('1. Inscription d\'un nouveau candidat', 'POST', '/api/auth/signup', {
        auth: null,
        prerequest: () => {
          const n = Date.now();
          pm.collectionVariables.set('procEmail', `raifguizani10+process${n}@gmail.com`);
          pm.collectionVariables.set('procNom', `Process${String(n).slice(-6)}`);
          pm.collectionVariables.unset('procPoll');
        },
        body: { firstName: 'Candidate', lastName: '{{procNom}}', email: '{{procEmail}}', password: 'Candidat@2026', preferredLanguage: 'fr' },
        test: () => {
          pm.test('Statut 201', () => pm.response.to.have.status(201));
          pm.collectionVariables.set('procToken', pm.response.json().data.accessToken);
        },
      }),
      req('2. Offre Développeur·se Full Stack', 'GET', '/api/jobs?metier=dev-fullstack&limit=1', { auth: null, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const job = pm.response.json().data.items[0];
        pm.test('Offre publiée trouvée', () => pm.expect(job).to.be.an('object'));
        pm.collectionVariables.set('procJobId', job.id);
      } }),
      req('3. Postuler avec le CV PDF (matching → invitation)', 'POST', '/api/applications', {
        auth: '{{procToken}}',
        body: { jobId: '{{procJobId}}', coverLetter: 'Développeuse Full Stack motivée par le recrutement.', cvFileName: 'CV_Postman.pdf', cvBase64: '{{crudCvBase64}}' },
        test: () => {
          pm.test('Statut 201', () => pm.response.to.have.status(201));
          const d = pm.response.json().data;
          pm.collectionVariables.set('procApplicationId', d.id);
          pm.collectionVariables.set('procInterviewId', (d.interview && (d.interview.id || d.interview._id)) || '');
          console.log(`Matching ${d.matching.score}/100 → ${d.status}`);
        },
      }),
      req('4. (si pas d\'invitation automatique) Le recruteur crée l\'entretien', 'POST', '/api/interviews', {
        prerequest: () => { if (pm.collectionVariables.get('procInterviewId')) pm.execution.skipRequest(); },
        body: { application: '{{procApplicationId}}', language: 'fr' },
        test: () => {
          pm.test('Statut 201', () => pm.response.to.have.status(201));
          pm.collectionVariables.set('procInterviewId', pm.response.json().data.id);
        },
      }),
      req('5. Entretien avant le quiz : refusé (409)', 'POST', '/api/interviews/{{procInterviewId}}/start', { auth: '{{procToken}}', body: { language: 'fr' }, test: () => {
        pm.test('Statut 409', () => pm.response.to.have.status(409));
        pm.test('Code QUIZ_REQUIRED', () => pm.expect(pm.response.json().code).to.eql('QUIZ_REQUIRED'));
      } }),
      req('6. Démarrer le quiz de compétences', 'POST', '/api/applications/{{procApplicationId}}/quiz/start', { auth: '{{procToken}}', test: () => {
        pm.test('Statut 201', () => pm.response.to.have.status(201));
        const d = pm.response.json().data;
        pm.test('Bonnes réponses jamais envoyées au candidat', () => d.questions.forEach((q) => pm.expect(q).to.not.have.property('correctIndex')));
        pm.collectionVariables.set('procAttemptId', d.attempt.id);
        pm.collectionVariables.set('procQuizAnswers', JSON.stringify(d.questions.map((q, i) => ({ questionId: q.id, selectedIndex: i % 2, timeMs: 9000 }))));
      } }),
      req('7. Envoyer les réponses du quiz (correction serveur)', 'POST', '/api/quiz-attempts/{{procAttemptId}}/submit', { auth: '{{procToken}}', body: { answers: '__QUIZ__' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Score et score par compétence', () => { pm.expect(d.attempt.percent).to.be.within(0, 100); pm.expect(d.attempt.perSkill.length).to.be.above(0); });
        console.log(`Quiz : ${d.attempt.percent} %`);
      } }),
      req('8. Démarrer l\'entretien avec l\'avatar (5 questions)', 'POST', '/api/interviews/{{procInterviewId}}/start', { auth: '{{procToken}}', body: { language: 'fr' }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const q = pm.response.json().data.interview.questions;
        pm.test('Présentation, 2 techniques, situation, motivation', () => pm.expect(q.map((x) => x.type)).to.eql(['presentation', 'technique', 'technique', 'situation', 'motivation']));
        pm.test('Grilles d\'attendus cachées au candidat', () => q.forEach((x) => pm.expect(x).to.not.have.property('keyPoints')));
        q.forEach((x, i) => console.log(`Q${i + 1} (${x.type}, ${x.skill}) : ${x.text}`));
      } }),
      req('9. Réponse 1 — ORALE (fichier WAV transcrit par Whisper)', 'POST', '/api/interviews/{{procInterviewId}}/answers', {
        auth: '{{procToken}}',
        body: { questionIndex: 0, audioFileName: 'reponse_presentation_fr.wav', audioBase64: '{{procAudioBase64}}' },
        test: () => pm.test('Statut 202 (analyse en arrière-plan)', () => pm.response.to.have.status(202)),
      }),
      req('10. Réponse 1 en double : refusée (409)', 'POST', '/api/interviews/{{procInterviewId}}/answers', { auth: '{{procToken}}', body: { questionIndex: 0, transcript: 'doublon' }, test: () => {
        pm.test('Statut 409', () => pm.response.to.have.status(409));
        pm.test('Code ALREADY_ANSWERED', () => pm.expect(pm.response.json().code).to.eql('ALREADY_ANSWERED'));
      } }),
      req('11. Réponse 2 — écrite (technique)', 'POST', '/api/interviews/{{procInterviewId}}/answers', { auth: '{{procToken}}', body: { questionIndex: 1, transcript: 'Je garde l\'état local avec useState, je le remonte ou j\'utilise un contexte quand plusieurs composants le partagent, et React Query pour les données du serveur. J\'évite les rendus inutiles avec la mémoïsation.' }, test: status(202) }),
      req('12. Réponse 3 — écrite (technique)', 'POST', '/api/interviews/{{procInterviewId}}/answers', { auth: '{{procToken}}', body: { questionIndex: 2, transcript: 'Je mesure d\'abord avec explain pour trouver la requête lente, j\'ajoute un index sur les champs filtrés, je limite les données avec une projection et la pagination, puis je vérifie le gain obtenu.' }, test: status(202) }),
      req('13. Réponse 4 — écrite (situation vécue)', 'POST', '/api/interviews/{{procInterviewId}}/answers', { auth: '{{procToken}}', body: { questionIndex: 3, transcript: 'Dans mon projet de fin d\'études, deux membres de l\'équipe n\'étaient pas d\'accord sur l\'architecture. J\'ai organisé une réunion, chacun a présenté ses arguments, nous avons fait un prototype et choisi ensemble. Le projet a été livré à temps.' }, test: status(202) }),
      req('14. Réponse 5 — écrite (motivation)', 'POST', '/api/interviews/{{procInterviewId}}/answers', { auth: '{{procToken}}', body: { questionIndex: 4, transcript: 'Votre mission dans le recrutement m\'attire, le poste correspond à mes compétences, et dans deux ans je me vois prendre des responsabilités techniques en continuant d\'apprendre.' }, test: status(202) }),
      req('15. Terminer l\'entretien', 'POST', '/api/interviews/{{procInterviewId}}/finish', { auth: '{{procToken}}', test: status(202) }),
      req('16. Attendre l\'évaluation (se répète jusqu\'au résultat)', 'GET', '/api/interviews/{{procInterviewId}}', {
        auth: '{{procToken}}',
        prerequest: () => { if (pm.collectionVariables.get('procPoll')) setTimeout(() => {}, 4000); },
        test: () => {
          const d = pm.response.json().data;
          const n = Number(pm.collectionVariables.get('procPoll') || 0);
          if (d.status !== 'evalue' && n < 60) {
            pm.collectionVariables.set('procPoll', n + 1);
            console.log(`Analyse en cours (${d.status}), nouvel essai ${n + 1}…`);
            pm.execution.setNextRequest(pm.info.requestName);
            return;
          }
          pm.collectionVariables.unset('procPoll');
          pm.test('Entretien évalué', () => pm.expect(d.status).to.eql('evalue'));
          pm.test('Note globale et composantes', () => pm.expect(d.evaluation).to.include.keys('overall', 'technical', 'communication', 'motivation', 'quiz', 'recommendation', 'summary'));
          const audio = d.answers.find((a) => a.questionIndex === 0);
          pm.test('Réponse orale transcrite par Whisper (français détecté)', () => { pm.expect(audio.inputMode).to.eql('voix'); pm.expect(audio.transcript.length).to.be.above(20); pm.expect(audio.detectedLanguage).to.eql('fr'); });
          pm.test('5 réponses notées avec un retour', () => { pm.expect(d.answers).to.have.length(5); d.answers.forEach((a) => pm.expect(a.feedback).to.be.a('string')); });
          console.log(`Note ${d.evaluation.overall}/100 — ${d.evaluation.recommendation}\nTranscription Whisper : « ${audio.transcript} »\n${d.evaluation.summary}`);
        },
      }),
      req('17. Le recruteur lit le résultat (grilles visibles)', 'GET', '/api/interviews/{{procInterviewId}}', { test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        const d = pm.response.json().data;
        pm.test('Grilles d\'attendus et points couverts / manqués', () => { pm.expect(d.questions[1].keyPoints.length).to.be.above(2); pm.expect(d.answers[1]).to.include.keys('coveredPoints', 'missedPoints', 'score'); });
      } }),
      req('18. Décision du recruteur : retenu (e-mail au candidat)', 'POST', '/api/interviews/{{procInterviewId}}/decision', { body: { value: 'retenu', comment: 'Très bon entretien, nous vous recontactons pour la suite.', notify: true }, test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Décision enregistrée', () => pm.expect(pm.response.json().data.decision.value).to.eql('retenu'));
      } }),
      req('19. Le candidat voit sa candidature retenue', 'GET', '/api/applications/{{procApplicationId}}', { auth: '{{procToken}}', test: () => {
        pm.test('Statut 200', () => pm.response.to.have.status(200));
        pm.test('Candidature retenue', () => pm.expect(pm.response.json().data.status).to.eql('retenue'));
      } }),
    ]),
  ],
};


// Historique de conversation injecté brut (tableau JSON) depuis la variable remplie par le pré-script.
const followUp = collection.item[3].item.find((r) => r.name.startsWith('Message — suite de conversation'));
followUp.request.body.raw = JSON.stringify({ message: 'Comment me préparer pour la suite ?', history: '__HISTORY__' }, null, 2).replace('"__HISTORY__"', '{{crudChatHistory}}');

// Réponses du quiz injectées brutes (tableau JSON) depuis la variable remplie au démarrage du quiz.
const quizSubmit = collection.item[4].item.find((r) => r.name.startsWith('7. '));
quizSubmit.request.body.raw = quizSubmit.request.body.raw.replace('"__QUIZ__"', '{{procQuizAnswers}}');

const withExamples = require('./examples').apply(collection, EXAMPLES);
fs.writeFileSync(OUT, JSON.stringify(collection, null, 2));
const count = collection.item.reduce((a, f) => a + f.item.length, 0);
if (require.main === module) console.log(`${path.basename(OUT)} : ${count} requêtes, ${withExamples} réponses réelles en exemple.`);
module.exports = { OUT, EXAMPLES, count };
