const { scrapeRecommendedCourses } = require('../services/recommendationService');
const UserProgress = require('../models/UserProgress');

exports.getRecommendations = async (req, res) => {
    try {
        // On récupère les paramètres de l'URL
        let skill = req.query.skill;
        const userId = req.query.userId;

        let criteriaUsed = "Recherche manuelle (mot-clé)";

        // LOGIQUE INTELLIGENTE : Si on a un userId mais pas de skill
        if (!skill && userId) {
            criteriaUsed = "Recommandation basée sur le parcours (IA)";
            
            // 1. On cherche le dernier cours validé (Terminé) par cet étudiant
            // On trie par date de mise à jour décroissante pour avoir le plus récent
            const lastProgress = await UserProgress.findOne({ 
                userId: userId, 
                status: 'Terminé' 
            }).sort({ updatedAt: -1 }).populate('courseId');

            // 2. Si on trouve un cours validé, on utilise son titre comme mot-clé
            if (lastProgress && lastProgress.courseId) {
                skill = lastProgress.courseId.title; 
            }
        }

        // Si on n'a ni skill ni userId valide, on renvoie une erreur 400
        if (!skill) {
            return res.status(400).json({ 
                message: "Veuillez fournir une compétence (?skill=React) ou un utilisateur (?userId=etudiant_demo)." 
            });
        }

        // 3. On lance le scraping (avec le mot-clé trouvé ou fourni)
        const recommendedCourses = await scrapeRecommendedCourses(skill);

        // 4. On renvoie la réponse enrichie
        res.status(200).json({
            message: `Recommandations pour : ${skill}`,
            criteria_used: criteriaUsed,
            data: recommendedCourses
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};