const progressService = require('../services/progressService');

exports.showUserJourney = async (req, res) => {
    try {
        const { userId } = req.params;
        const journey = await progressService.getUserJourney(userId);
        res.status(200).json({
            message: `Parcours de formation pour l'utilisateur ${userId}`,
            data: journey
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};