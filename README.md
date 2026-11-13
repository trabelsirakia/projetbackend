# TalentWave Live — recrutement par entretien vidéo avec un avatar IA

Équipe DataWave · ESPRIT. Backend **Node.js / Express / MongoDB**, frontend **React (Vite, Tailwind, Motion)**,
IA **100 % locale** (Whisper, MiniLM multilingue, Llama 3.1 via Ollama).

> **Tout commence au clic sur « Postuler ».**
> CV PDF → job matching IA expliqué → e-mail d'acceptation (quiz + salle d'entretien + lien Google Meet / Jitsi)
> → quiz de compétences chronométré → entretien vidéo de **5 minutes** avec l'avatar « Nora » (questions à voix haute,
> un instant pour se préparer, réponse orale en **français ou anglais** transcrite par Whisper) → note expliquée
> → décision du recruteur et e-mail au candidat. Un **chatbot** accompagne le candidat à chaque étape.

---

## 1. Cahier des charges (la « prompt » du projet)

> Construire une plateforme de recrutement de bout en bout, en français, respectant l'architecture MVC imposée
> (racine : `app.js`, `config/`, `controller/`, `models/`, `public/`, `routes/`, `views/`).
> 1. **Comptes** : inscription, connexion, mot de passe oublié (lien par e-mail, 15 min, usage unique), rôles candidat / recruteur / admin.
> 2. **Postuler** : un candidat dépose son CV PDF sur une offre. L'IA calcule un score 0-100 **expliqué** (compétences prouvées
>    par une phrase du CV, proximité sémantique, expérience, langues). Au-dessus du seuil de l'offre : e-mail d'acceptation
>    contenant le lien du quiz, de la salle d'entretien et un lien de **visioconférence Google Meet** ; sinon e-mail de refus expliqué.
> 3. **Deux entités métier**, chacune avec CRUD complet, **recherche, filtres, tri, pagination et statistiques** :
>    - **Quiz** : QCM de compétences passé avant l'entretien (chrono et correction côté serveur, score par compétence).
>    - **Entretien** : visioconférence de 5 minutes menée par un **avatar** qui pose les questions en temps réel ; il laisse
>      un instant au candidat, capte sa réponse orale (fr / en), puis donne un résultat selon les réponses.
> 4. **Logique par métier** : chaque offre appartient à un métier qui fixe les compétences, la banque de quiz, les questions
>    d'entretien avec leur grille d'attendus et la pondération de la note.
> 5. **Chatbot** pour aider le candidat (fonctionnement, suivi, entraînement aux questions d'entretien).
> 6. **IA réelle et locale** : modèles pré-entraînés téléchargés automatiquement ; mécanismes vérifiables (pas de score inventé).
> 7. **Frontend** attirant, responsive, thème clair / sombre, couleurs TalentWave.
> 8. **Tests** : Swagger, collection Postman, lanceurs `.bat` (Newman + rapport PDF) et application Postman.

## 2. Plan de travail suivi

| # | Étape | Livrable |
|---|---|---|
| 1 | Modèle de données et logique par métier | `models/*.js`, `controller/ai/data/metiers.js` |
| 2 | Auth, offres, candidatures, e-mails, visio | services `auth`, `job`, `application`, `email`, `meet` |
| 3 | IA : matching, quiz, entretien, notation, synthèse, chatbot | `controller/ai/*` (+ téléchargement des modèles) |
| 4 | CRUD + recherche / filtres / tri / pagination / stats des **Quiz** et **Entretiens** | `quizService`, `interviewService`, `config/utils/listQuery.js` |
| 5 | Interface React (candidat, salle d'entretien avec avatar, recruteur, admin) | `views/` → `public/` |
| 6 | Swagger, Postman, `.bat` | `config/swagger`, `routes/tests/postman` |
| 7 | Tests de bout en bout + autocritique et corrections | 198 tests Postman, `npm test` |

## 3. Démarrage

### En un seul fichier (PC Windows neuf) : **`INSTALLER_ET_LANCER.bat`** (double-clic)

Fait tout, de A à Z, et s'arrête avec un message clair si une étape échoue (journal : `installation.log`) :

1. **Node.js 20+, MongoDB, Ollama** : vérifiés, installés avec `winget` s'ils manquent, démarrés.
2. **`.env`** : celui fourni est gardé ; sinon il est créé (secrets JWT aléatoires) et le lanceur demande l'adresse Gmail
   et son mot de passe d'application pour envoyer les **vrais e-mails**.
3. **`npm ci`**, puis **téléchargement automatique des modèles IA réels** : Whisper small, MiniLM multilingue (≈ 370 Mo),
   Llama 3.1 8B (≈ 4,9 Go via Ollama). Une seule fois ; les lancements suivants sont rapides.
4. Interface compilée (`npm run build`), puis **les données réelles du projet** (`models/donnees/talentwave_live.json` :
   comptes, offres, quiz, passages, candidatures avec CV, entretiens avec transcriptions et notes), rechargées par
   `npm run data:import` ; à défaut, base de démonstration (`npm run seed`). Une base existante n'est jamais écrasée sans `--reinitialiser`.
5. `npm test` + **collection Postman complète** (Newman, e-mails réellement envoyés et vérifiés) → `rapport-postman.pdf`.
6. Lancement sur **http://localhost:8200** et ouverture du navigateur.
7. **Collection Postman CRUD** exécutée sur l'application lancée (`routes/tests/postman/TalentWave-Live-CRUD.postman_collection.json`) :
   CRUD Quiz et Entretiens (recherche, filtres, tri, pagination, statistiques), chatbot, processus d'entretien complet.

Mettre à jour les données emportées avant d'envoyer le projet : `npm run data:export`.
E-mails : `MAIL_REDIRECT_TO` dans `.env` envoie TOUS les e-mails (et invitations Agenda) à une seule adresse, le sujet indiquant le destinataire prévu.

Options : `INSTALLER_ET_LANCER.bat --sans-tests` · `--reinitialiser` (recrée la base de démonstration).

### À la main

```bash
npm install
npm run models     # télécharge et vérifie Whisper + MiniLM (≈ 370 Mo, une seule fois) et llama3.1:8b (Ollama)
npm run seed       # base de démonstration talentwave_live (refuse d'écraser une base existante sans --force)
npm run dev        # API http://localhost:8200 + interface http://localhost:5175
```

Ou, version compilée : `npm run build` puis `npm start` → tout sur http://localhost:8200.
Swagger : http://localhost:8200/api-docs

Prérequis : Node ≥ 20, MongoDB (service Windows), Ollama (facultatif : sans lui, la notation utilise les embeddings seuls
et le chatbot passe en mode extractif — c'est signalé dans les réponses).

### Comptes de démonstration (adresses « + » : les e-mails arrivent vraiment dans la boîte du projet)

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Admin | raifguizani10+live-admin@gmail.com | Admin@2026 |
| Recruteur | raifguizani10+live-rh@gmail.com | Recruteur@2026 |
| Candidat·e·s | raifguizani10+live-candidat1…6@gmail.com | Candidat@2026 |

`candidat3` (Ines) et `candidat6` (Omar) n'ont pas encore postulé au départ : idéal pour une démonstration complète.

### Google Meet

Sans configuration, chaque entretien reçoit une salle **Jitsi Meet** (visio libre, sans compte).
Pour de **vrais liens Google Meet** (événement Google Agenda + invitation au candidat) : créer un ID client OAuth
« Application de bureau » (Google Cloud, API Calendar activée), le mettre dans `.env`, puis `npm run google:auth`.

## 4. Logique par métier

`controller/ai/data/metiers.js` — 6 métiers : Full Stack, Data Scientist, DevOps / Cloud, Designer UX/UI, Marketing digital, Comptabilité.

| Métier | Quiz | Technique | Communication | Motivation |
|---|---|---|---|---|
| Full Stack, Data Scientist | 25 % | 45 % | 15 % | 15 % |
| DevOps, Comptabilité | 30 % | 40 % | 15 % | 15 % |
| Designer UX/UI | 20 % | 40 % | 25 % | 15 % |
| Marketing digital | 20 % | 35 % | 30 % | 15 % |

Chaque métier définit : compétences et variantes d'écriture (matching), banque de QCM, questions d'entretien fr / en avec
**grille d'attendus**. Déroulé des 5 minutes : présentation (45 s) → technique sur la compétence **la plus faible au quiz**
(60 s) → technique **générée par le LLM** sur la compétence faible suivante ou manquante du CV (60 s) → situation vécue (50 s)
→ motivation (45 s).

## 5. Entités et attributs

**Quiz** (entité 1) : `title, description, metier, job, language, difficulty, durationMinutes, passingScore, questionsPerAttempt,
shuffleQuestions, maxAttempts, status (actif|inactif|archive), source (banque|ia|manuel), createdBy,
questions[] { text, options[2-6], correctIndex, explanation, skill, points, difficulty }`.
Passage : **QuizAttempt** `{ quiz, application, candidate, questionIds, answers[], score, maxScore, percent, passed, perSkill[], status, startedAt, deadlineAt, submittedAt }`.

**Entretien** (entité 2) : `application, candidate, candidateName, job, quizAttempt, metier, title, scheduledAt, expiresAt,
durationMinutes, language, meet { provider, link, eventId }, avatar { name, voice },
questions[] { order, type, skill, text, keyPoints, timeLimitSec, source },
answers[] { questionIndex, transcript, inputMode, detectedLanguage, durationSec, wordsPerMinute, scores { relevance, coverage, communication, llm }, score, coveredPoints, missedPoints, feedback },
evaluation { overall, technical, communication, motivation, quiz, weights, recommendation, summary, strengths, improvements, method },
decision { value, comment, by, at }, status (planifie|en_cours|termine|evalue|annule|expire), startedAt, endedAt, recruiterNotes`.

Autres : **User**, **Job** (offre, `matchThreshold` = seuil d'invitation), **Application** (candidature, `matching` expliqué, `timeline`).

**Métiers simples sur les deux entités** (`GET /api/quizzes`, `GET /api/interviews`) : `q` (recherche insensible aux accents),
filtres (métier, statut, difficulté, origine, langue, plages de durée / seuil / note / dates, avis IA, décision), `sort` (`-champ`
= décroissant), `page`, `limit` ; statistiques : `GET /api/quizzes/stats`, `GET /api/interviews/stats`.

## 6. IA (modèles pré-entraînés, exécutés localement)

| Modèle | Rôle | Où |
|---|---|---|
| **OpenAI Whisper small** (ONNX q8, thread dédié) | Détection fr/en par les jetons de langue, puis transcription | `controller/ai/asrWorker.js` |
| **paraphrase-multilingual-MiniLM-L12-v2** | Matching CV ↔ offre, réponse ↔ grille (multilingue), recherche du chatbot | `hfModels.js`, `matching.js`, `answerScorer.js` |
| **Llama 3.1 8B** (Ollama) | Juge des réponses (JSON contraint), question personnalisée, synthèse, agent du chatbot | `ollamaClient.js` |

- **Matching** (`matching.js`) : compétences littérales (frontières Unicode) puis sémantiques, similarité offre ↔ CV, années d'expérience
  (périodes fusionnées), langues → score pondéré + phrases « Pourquoi ce score ».
- **Notation d'une réponse** (`answerScorer.js`) : couverture de la grille (phrases + fenêtres glissantes, seuil calibré : bonne
  réponse 0,5-0,8, hors sujet < 0,1 ; densité ≈ 7 mots par attendu), pertinence, communication (débit, tics, longueur),
  juge LLM ; fusion 45 / 15 / 40.
- **Chatbot** (`chatbot.js`) : RAG hybride BM25 + embeddings (fusion RRF) et boucle d'outils sur les vraies données du candidat
  (candidatures, entretien, quiz, offres, entraînement noté par le même correcteur).
- **Navigateur** : voix de l'avatar (synthèse vocale), capture micro en PCM → WAV 16 kHz (aucun ffmpeg), détection de silence,
  sous-titres en direct (indicatifs ; la transcription notée est celle de Whisper).

## 7. Tests

| Outil | Commande | Contenu |
|---|---|---|
| Postman (Newman) | **`TESTER_POSTMAN.bat`** ou `npm run postman:run` | 111 requêtes, **201 tests**, instance isolée (port 8201, base `talentwave_live_postman`), **e-mails réellement envoyés** par Gmail et vérifiés (accusé SMTP) → `rapport-postman.pdf` (`--emails-captures` pour ne rien envoyer) |
| Application Postman | **`SERVEUR_POSTMAN.bat`** puis importer `routes/tests/postman/*.json` (ou `npm run postman:push` avec `POSTMAN_API_KEY` dans `.env`) | Même collection dans le Runner ; **chaque requête contient sa réponse réelle** (onglet *Examples*), enregistrée au dernier passage |
| Swagger | http://localhost:8200/api-docs | Tous les endpoints, exemples, bouton Authorize |
| Unitaires | `npm test` | Architecture de la racine, expérience, WAV, pondérations, communication |

La collection couvre aussi une **vraie réponse orale** (`fichiers/reponse_presentation_fr.wav`) : Whisper doit détecter le français.

## 8. Limites connues

- La transcription tourne sur le processeur (≈ 5 s pour 20 s d'audio) ; l'évaluation finale prend environ une minute avec le LLM.
- L'avatar parle avec la voix du navigateur : la qualité dépend des voix installées (Edge « Natural » recommandées).
- Les sous-titres en direct nécessitent Chrome ou Edge ; le micro et la caméra exigent `localhost` ou HTTPS.
- L'entretien noté se passe dans la salle de la plateforme ; Google Meet / Jitsi sert à l'échange avec le recruteur.
