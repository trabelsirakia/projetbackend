const Certification = require('../models/Certification');
const UserProgress = require('../models/UserProgress');
const Course = require('../models/Course');
const PDFDocument = require('pdfkit');

// 1. Créer un test ou un examen (Réservé aux RH/Admin)
exports.createTest = async (req, res) => {
    try {
        const newTest = new Certification(req.body);
        await newTest.save();
        res.status(201).json({ message: "Test créé avec succès", test: newTest });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// 2. Récupérer les questions d'un test (SÉCURITÉ SIMPLIFIÉE)
exports.getTestQuestions = async (req, res) => {
    try {
        const { testId } = req.params;
        const { userId } = req.query; // On récupère l'userId dans l'URL

        // A. On cherche le test
        const test = await Certification.findById(testId);
        if (!test) return res.status(404).json({ message: "Test introuvable" });

        // B. SÉCURITÉ : On vérifie que l'étudiant a bien terminé le cours
        if (userId) {
            const progress = await UserProgress.findOne({ userId: userId, courseId: test.courseId });

            if (!progress || progress.status !== 'Terminé') {
                return res.status(403).json({ 
                    message: "Accès refusé. Vous n'avez pas terminé le cours associé à ce test." 
                });
            }
        }

        // C. On renvoie les questions SANS les réponses (pour éviter la triche)
        const safeQuestions = test.questions.map(q => ({
            _id: q._id,
            questionText: q.questionText,
            options: q.options
        }));

        res.status(200).json({
            title: test.title,
            type: test.type,
            passingScore: test.passingScore,
            questions: safeQuestions
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Soumettre les réponses et calculer le score
exports.submitTest = async (req, res) => {
    try {
        const { userId, answers } = req.body; 
        const { testId } = req.params;

        const test = await Certification.findById(testId);
        if (!test) return res.status(404).json({ message: "Test introuvable" });

        // ⚠️ POUR LA DEMO : On valide automatiquement toutes les réponses
        // Le score est de 100% peu importe ce que l'étudiant répond.
        const correctCount = test.questions.length; 
        const totalQuestions = test.questions.length;

        // Calcul du score (sera toujours 100)
        const score = Math.round((correctCount / totalQuestions) * 100);
        const isPassed = score >= test.passingScore;

        // Mettre à jour la progression de l'utilisateur
        let progress = await UserProgress.findOne({ userId, courseId: test.courseId });
        
        if (!progress) {
            progress = new UserProgress({ userId, courseId: test.courseId });
        }

        progress.score = score;
        progress.status = isPassed ? 'Terminé' : 'Échoué';
        progress.isCertified = isPassed;
        progress.updatedAt = Date.now();
        await progress.save(); // Le Hook Mongoose va se déclencher ici si c'est "Terminé"

        res.status(200).json({
            message: isPassed ? "Félicitations, vous avez validé le test !" : "Dommage, vous n'avez pas atteint le score requis.",
            score: score,
            passingScore: test.passingScore,
            isPassed: isPassed,
            progress: progress
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. Télécharger le certificat en PDF
exports.downloadCertificate = async (req, res) => {
    try {
        const { progressId } = req.params;

        const progress = await UserProgress.findById(progressId).populate('courseId');
        
        if (!progress || !progress.isCertified) {
            return res.status(403).json({ message: "Accès refusé. Vous n'avez pas validé ce cours." });
        }

        // Création du document PDF
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Certificat_${progress.courseId.title}.pdf"`);

        doc.pipe(res);

        // Dessin du PDF
        doc.fontSize(30).fillColor('#4A148C').text('TalentWave', { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(20).fillColor('black').text('CERTIFICAT DE RÉUSSITE', { align: 'center', underline: true });
        doc.moveDown(2);
        doc.fontSize(14).text(`Ce certificat est officiellement décerné au candidat :`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(24).fillColor('#1976D2').text(progress.userId, { align: 'center' });
        doc.moveDown(1.5);
        doc.fontSize(14).fillColor('black').text(`Pour avoir complété avec succès le module :`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(20).fillColor('#388E3C').text(progress.courseId.title, { align: 'center' });
        doc.moveDown(2);
        doc.fontSize(14).fillColor('black').text(`Score final obtenu : ${progress.score} / 100`, { align: 'center' });
        doc.moveDown(0.5);
        doc.text(`Date de délivrance : ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });
        doc.moveDown(4);
        doc.fontSize(10).fillColor('gray').text('Ce document atteste de la validation des compétences sur la plateforme intelligente TalentWave.', { align: 'center', italic: true });

        doc.end();

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};