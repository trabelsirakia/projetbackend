const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/db');

// 1. Importer toutes les routes
const courseRoutes = require('./routes/courseRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const antiCheatRoutes = require('./routes/antiCheatRoutes');
const statsRoutes = require('./routes/statsRoutes');
const progressRoutes = require('./routes/progressRoutes'); // <-- NOUVEAU

// 2. Charger les variables d'environnement
dotenv.config();

// 3. Connexion à la base de données MongoDB
connectDB();

// 4. Initialiser l'application Express
const app = express();

// 5. Middlewares de sécurité et de parsing
app.use(helmet({
    contentSecurityPolicy: false, 
}));
app.use(cors());
app.use(express.json());

// 6. Servir les fichiers statiques du dossier "public" (pour la démo webcam)
app.use(express.static(path.join(__dirname, 'public')));

// 7. Définir les routes de l'API
app.get('/api/certification/test', (req, res) => {
    res.json({ message: "Le microservice Certification fonctionne ! 🎉" });
});

app.use('/api/courses', courseRoutes);
app.use('/api/tests', evaluationRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/anticheat', antiCheatRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/progress', progressRoutes); // <-- NOUVEAU

// 8. Démarrer le serveur
const PORT = process.env.PORT || 3009;
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`Testez l'API : http://localhost:${PORT}/api/certification/test`);
    console.log(`Testez le Frontend (Webcam) : http://localhost:${PORT}`);
});