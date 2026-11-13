const Course = require('../models/Course');
const UserProgress = require('../models/UserProgress');

// 1. Créer un nouveau cours (Réservé aux RH/Admin plus tard)
exports.createCourse = async (req, res) => {
    try {
        const newCourse = new Course(req.body);
        await newCourse.save();
        res.status(201).json({ message: "Cours créé avec succès", course: newCourse });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// 2. Voir tous les cours (AVEC TRI, PAGINATION ET RECHERCHE AVANCÉE)
exports.getAllCourses = async (req, res) => {
    try {
        // 1. Récupération des paramètres de l'URL
        const { 
            difficulty,   // Filtre par difficulté (ex: ?difficulty=Débutant)
            search,       // Recherche par mot-clé (ex: ?search=Node)
            sort,         // Tri (ex: ?sort=newest, ?sort=title)
            page = 1,     // Numéro de page (par défaut 1)
            limit = 10    // Nombre d'éléments par page (par défaut 10)
        } = req.query;

        // 2. Construction du filtre de recherche
        let queryFilter = {};

        if (difficulty) {
            queryFilter.difficulty = difficulty;
        }

        // Recherche avancée (insensible à la casse) sur le titre ou la description
        if (search) {
            queryFilter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // 3. Construction du tri
        let sortOption = {};
        if (sort === 'newest') sortOption.createdAt = -1;
        else if (sort === 'oldest') sortOption.createdAt = 1;
        else if (sort === 'title') sortOption.title = 1;
        else sortOption.createdAt = -1; // Par défaut : les plus récents d'abord

        // 4. Calcul de la pagination
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;

        // 5. Exécution de la requête
        const courses = await Course.find(queryFilter)
            .sort(sortOption)
            .skip(skip)
            .limit(limitNumber)
            .populate('prerequisites', 'title');

        // 6. Compter le nombre total de cours (pour que le frontend sache combien de pages afficher)
        const totalCourses = await Course.countDocuments(queryFilter);

        // 7. Renvoyer la réponse structurée
        res.status(200).json({
            message: "Liste des cours récupérée avec succès",
            pagination: {
                totalCourses: totalCourses,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalCourses / limitNumber),
                itemsPerPage: limitNumber
            },
            data: courses
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. S'inscrire à un cours (AVEC VÉRIFICATION DES PRÉREQUIS)
exports.enrollInCourse = async (req, res) => {
    try {
        const { userId } = req.body; 
        const { courseId } = req.params; 

        // A. Trouver le cours
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ message: "Cours introuvable" });

        // B. Vérifier si l'utilisateur a déjà validé les prérequis
        if (course.prerequisites && course.prerequisites.length > 0) {
            for (let prereqId of course.prerequisites) {
                // On cherche si l'utilisateur a un "UserProgress" Terminé pour ce prérequis
                const progress = await UserProgress.findOne({
                    userId: userId,
                    courseId: prereqId,
                    status: 'Terminé'
                });

                if (!progress) {
                    return res.status(403).json({ 
                        message: "Accès refusé. Vous n'avez pas validé tous les prérequis pour ce cours." 
                    });
                }
            }
        }

        // C. Si tout est bon, on crée le suivi de parcours
        const newProgress = new UserProgress({
            userId: userId,
            courseId: courseId,
            status: 'En cours'
        });
        await newProgress.save();

        res.status(200).json({ message: "Inscription réussie !", progress: newProgress });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. Modifier un cours (Mise à jour)
exports.updateCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        
        const updatedCourse = await Course.findByIdAndUpdate(
            courseId, 
            req.body, 
            { new: true, runValidators: true }
        );

        if (!updatedCourse) {
            return res.status(404).json({ message: "Cours introuvable" });
        }

        res.status(200).json({ message: "Cours mis à jour avec succès", course: updatedCourse });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// 5. Supprimer un cours
exports.deleteCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        
        const deletedCourse = await Course.findByIdAndDelete(courseId);

        if (!deletedCourse) {
            return res.status(404).json({ message: "Cours introuvable" });
        }

        res.status(200).json({ message: "Cours supprimé avec succès", course: deletedCourse });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};