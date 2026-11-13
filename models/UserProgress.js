const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    status: {
        type: String,
        enum: ['Non commencé', 'En cours', 'Terminé', 'Échoué'],
        default: 'En cours'
    },
    score: {
        type: Number,
        default: 0
    },
    isCertified: {
        type: Boolean,
        default: false
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Empêcher un utilisateur d'avoir deux suivis pour le même cours
userProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// HOOK : Quand un étudiant termine un cours, on débloque le test lié
userProgressSchema.post('save', async function(doc, next) {
    try {
        if (doc.status === 'Terminé') {
            const Certification = mongoose.model('Certification');
            await Certification.updateMany(
                { courseId: doc.courseId },
                { $set: { isAvailable: true } }
            );
            console.log(`✅ Cours ${doc.courseId} terminé : Les tests ont été débloqués !`);
        }
        next();
    } catch (error) {
        console.error("Erreur lors du déblocage du test :", error);
        next(error);
    }
});

module.exports = mongoose.model('UserProgress', userProgressSchema);