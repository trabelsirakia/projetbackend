const AntiCheatLog = require('../models/AntiCheatLog');

// 1. Créer un journal de surveillance au début du test
exports.startSurveillance = async (req, res) => {
    try {
        const { userId, testId } = req.body;
        const newLog = new AntiCheatLog({ userId, testId });
        await newLog.save();
        res.status(201).json({ message: "Surveillance démarrée", logId: newLog._id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Signaler un incident (Appelé par le frontend en temps réel)
exports.reportIncident = async (req, res) => {
    try {
        const { logId } = req.params;
        const { type } = req.body; // ex: 'Phone Detected'

        const log = await AntiCheatLog.findById(logId);
        if (!log) return res.status(404).json({ message: "Session de surveillance introuvable" });

        // Ajouter l'incident
        log.incidents.push({ type });

        // Calculer la pénalité (ex: -20 points par incident)
        log.integrityScore = log.integrityScore - 20;

        // Si le score tombe en dessous de 50, le test devient "Suspect"
        if (log.integrityScore < 50) {
            log.status = 'Suspect';
        }

        await log.save();
        res.status(200).json({ 
            message: "Incident enregistré", 
            currentScore: log.integrityScore,
            status: log.status 
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Vérifier le score final (Appelé par le RH)
exports.getSurveillanceReport = async (req, res) => {
    try {
        const log = await AntiCheatLog.findById(req.params.logId);
        if (!log) return res.status(404).json({ message: "Rapport introuvable" });
        res.status(200).json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};