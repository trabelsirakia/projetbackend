const express = require('express');
const router = express.Router();
const antiCheatController = require('../controllers/antiCheatController');

router.post('/start', antiCheatController.startSurveillance);
router.post('/:logId/report', antiCheatController.reportIncident);
router.get('/:logId/report', antiCheatController.getSurveillanceReport);

module.exports = router;