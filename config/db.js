const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connexion réussie à MongoDB');
    } catch (error) {
        console.error('❌ Erreur de connexion à MongoDB :', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;