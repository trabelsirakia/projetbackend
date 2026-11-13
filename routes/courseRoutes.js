const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');

// Route pour créer un cours
router.post('/', courseController.createCourse);

// Route pour voir tous les cours
router.get('/', courseController.getAllCourses);

// Route pour s'inscrire à un cours (avec vérification des prérequis)
router.post('/:courseId/enroll', courseController.enrollInCourse);
// Route pour modifier un cours (PUT)
router.put('/:courseId', courseController.updateCourse);

// Route pour supprimer un cours (DELETE)
router.delete('/:courseId', courseController.deleteCourse);
module.exports = router;