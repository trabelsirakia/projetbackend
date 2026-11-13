/**
 * Envoi des e-mails : SMTP réel (Gmail) avec 3 tentatives espacées ; en mode capture (tests, instance Postman),
 * l'e-mail est construit puis rangé dans l'outbox (lisible par GET /api/test-mails) au lieu d'être envoyé.
 * En mode journal (MAIL_JOURNAL=1), il est RÉELLEMENT envoyé et l'outbox garde la trace de sa remise (accusé SMTP).
 * Les envois ne bloquent jamais la requête HTTP : une panne SMTP est journalisée, l'action métier reste valide.
 */
const env = require('../../config/env');
const logger = require('../../config/utils/logger');
const { getTransporter, outbox, captureMode, journalMode } = require('../../config/mailer');
const templates = require('../../views/emails/templates');

const links = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

async function send(to, templateName, data) {
  const mail = templates[templateName](data);
  // MAIL_REDIRECT_TO : tous les e-mails partent vers une seule boîte ; le sujet garde le destinataire prévu.
  const redirect = (process.env.MAIL_REDIRECT_TO || '').trim();
  const deliveredTo = redirect || to;
  const subject = redirect && redirect.toLowerCase() !== String(to).toLowerCase() ? `[pour ${to}] ${mail.subject}` : mail.subject;
  const message = { from: `TalentWave Live <${env.smtp.from}>`, to: deliveredTo, subject, html: mail.html, text: mail.text };
  if (captureMode()) {
    outbox.push({ to, template: templateName, subject: mail.subject, links: links(mail.html), text: mail.text, at: new Date() });
    if (outbox.length > 200) outbox.shift();
    await getTransporter().sendMail(message);
    return { captured: true };
  }
  // Journal : l'entrée existe dès la construction (liens lisibles aussitôt), sa remise est complétée après l'envoi SMTP.
  const entry = journalMode() ? { to, deliveredTo, template: templateName, subject: mail.subject, links: links(mail.html), text: mail.text, at: new Date(), delivery: 'en_cours' } : null;
  if (entry) { outbox.push(entry); if (outbox.length > 200) outbox.shift(); }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const info = await getTransporter().sendMail(message);
      logger.info(`E-mail « ${mail.subject} » envoyé à ${deliveredTo}${deliveredTo !== to ? ` (prévu pour ${to})` : ''}`);
      if (entry) Object.assign(entry, { delivery: 'envoye', messageId: info.messageId, accepted: info.accepted, smtpResponse: info.response });
      return { messageId: info.messageId };
    } catch (err) {
      logger.warn(`E-mail à ${to} : tentative ${attempt}/3 échouée (${err.message})`);
      if (entry) entry.lastError = err.message;
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  if (entry) entry.delivery = 'echec';
  return { failed: true };
}

/** Envoi en arrière-plan : la réponse HTTP n'attend pas le serveur SMTP. */
function sendLater(to, templateName, data) {
  send(to, templateName, data).catch((err) => logger.error(`E-mail ${templateName} non envoyé : ${err.message}`));
}

module.exports = { send, sendLater };
