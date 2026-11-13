const env = require('./env');
const logger = require('./utils/logger');
const { connectDB, disconnectDB } = require('./db');
const { verifySmtp, captureMode } = require('./mailer');
const interviews = require('../controller/services/interviewService');
const llm = require('../controller/ai/ollamaClient');
const hf = require('../controller/ai/hfModels');

/** Démarrage du serveur (app.js lancé directement : npm start / npm run dev). */
async function start(app) {
  process.on('unhandledRejection', (reason) => logger.error('Promesse rejetée non gérée :', reason));
  try {
    await connectDB(env.mongoUri);
  } catch (err) {
    logger.error(`Connexion MongoDB impossible (${env.mongoUri}) : ${err.message}`);
    logger.error('Démarrez MongoDB (service Windows « MongoDB ») puis relancez.');
    process.exit(1);
  }

  verifySmtp()
    .then(() => logger.info(captureMode() ? 'E-mails CAPTURÉS (MAIL_CAPTURE=1) : construits, jamais envoyés' : `SMTP prêt (${env.smtp.host} en tant que ${env.smtp.user})`))
    .catch((err) => logger.warn(`SMTP indisponible, les e-mails ne partiront pas : ${err.message}`));
  logger.info(env.google.configured ? 'Visioconférence : Google Meet (API Google Agenda)' : 'Visioconférence : Jitsi Meet (Google non configuré : npm run google:auth)');

  // Modèles IA chargés dès le démarrage : la première candidature / le premier entretien n'attendent pas.
  hf.warmUp();
  if (!env.aiOffline) llm.warmUp();
  const sweeper = interviews.startSweeper();

  const server = app.listen(env.port, () => {
    logger.info(`API TalentWave Live sur http://localhost:${env.port}  (Swagger : http://localhost:${env.port}/api-docs)`);
  });
  // Connexions keep-alive gardées 65 s (défaut Node : 5 s) : évite les « socket hang up » des clients qui
  // réutilisent une connexion après une pause (Newman, proxy, navigateur).
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.on('error', (err) => {
    logger.error(err.code === 'EADDRINUSE' ? `Le port ${env.port} est déjà utilisé. Arrêtez l'autre processus ou changez PORT.` : err);
    process.exit(1);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} reçu, arrêt propre...`);
    sweeper.stop();
    hf.shutdown().catch(() => {});
    server.close(async () => {
      await disconnectDB().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { start };
