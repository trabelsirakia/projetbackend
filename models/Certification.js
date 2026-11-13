const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    questionText: {
        type: String,
        required: true
    },
    options: [{
        type: String,
        required: true
    }],
    correctAnswer: {
        type: String,
        required: true
    }
});

const certificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    // Est-ce un white test (entraînement) ou un examen final ?
    type: {
        type: String,
        enum: ['WhiteTest', 'ExamenFinal'],
        required: true
    },
    // Le cours auquel cette certification est liée
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    questions: [questionSchema],
    passingScore: {
        type: Number,
        default: 70 // Il faut 70% pour valider
    }
});

module.exports = mongoose.model('Certification', certificationSchema);