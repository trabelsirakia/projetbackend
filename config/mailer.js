const nodemailer = require('nodemailer');
const env = require('./env');

/**
 * Transport SMTP réel (Gmail mot de passe d'application ou Mailtrap) en dev et en prod.
 * Les e-mails sont CAPTURÉS (construits mais jamais envoyés) dans deux cas :
 *  - NODE_ENV=test : capturés en mémoire (outbox) pour que les tests lisent leur contenu ;
 *  - MAIL_CAPTURE=1 : instance de test lancée par le lanceur Postman, pour ne pas remplir la boîte réelle
 *    à chaque passage de la collection (une vingtaine d'e-mails sinon).
 * MAIL_JOURNAL=1 (instance Postman par défaut) : e-mails RÉELLEMENT envoyés par SMTP ET journalisés dans l'outbox
 * avec l'accusé du serveur SMTP (messageId), pour que la collection vérifie leur contenu et leur remise.
 */
let transporter = null;
const outbox = [];
const captureMode = () => env.isTest || process.env.MAIL_CAPTURE === '1';
const journalMode = () => !env.isProd && process.env.MAIL_JOURNAL === '1';

function getTransporter() {
  if (transporter) return transporter;

  if (captureMode()) {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  } else {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

async function verifySmtp() {
  if (captureMode()) return true;
  await getTransporter().verify();
  return true;
}

module.exports = { getTransporter, verifySmtp, outbox, captureMode, journalMode };
