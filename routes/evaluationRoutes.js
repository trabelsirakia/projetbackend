const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');

// Route pour créer un test
router.post('/', evaluationController.createTest);

// Route pour récupérer les questions d'un test
router.get('/:testId/questions', evaluationController.getTestQuestions);

// Route pour soumettre les réponses d'un test
router.post('/:testId/submit', evaluationController.submitTest);
// Route pour télécharger le certificat PDF
router.get('/:progressId/certificate', evaluationController.downloadCertificate);

module.exports = router;