const mongoose = require('mongoose');

const antiCheatLogSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    testId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Certification',
        required: true
    },
    incidents: [{
        type: {
            type: String,
            enum: ['Phone Detected', 'Multiple Faces', 'Looking Away', 'Tab Switched'],
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    integrityScore: {
        type: Number,
        default: 100 // On commence à 100 et on pénalise
    },
    status: {
        type: String,
        enum: ['En cours', 'Suspect', 'Validé'],
        default: 'En cours'
    }
}, { timestamps: true });

module.exports = mongoose.model('AntiCheatLog', antiCheatLogSchema);