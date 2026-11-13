const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Le titre du cours est obligatoire"],
        trim: true
    },
    description: {
        type: String,
        required: [true, "La description est obligatoire"]
    },
    difficulty: {
        type: String,
        enum: ['Débutant', 'Intermédiaire', 'Avancé'],
        default: 'Débutant'
    },
    // Les prérequis : une liste d'IDs d'autres cours qu'il faut avoir fini
    prerequisites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course' // Référence au modèle Course lui-même
    }],
    // Le lien vers le contenu (vidéo, PDF, etc.)
    contentUrl: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Course', courseSchema);