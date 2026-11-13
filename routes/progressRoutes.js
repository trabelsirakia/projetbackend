const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');

router.get('/:userId', progressController.showUserJourney);

module.exports = router;