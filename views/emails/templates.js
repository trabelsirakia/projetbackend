/**
 * Gabarits des e-mails (HTML compatible clients mail : tableaux + styles en ligne, version texte fournie).
 * Couleurs de la marque TalentWave : marine #16304f, bleu #1f5fad, fond #f3f5f9.
 */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtDate = (d) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Tunis' });

function layout(title, body) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f3f5f9;font-family:Segoe UI,Arial,sans-serif;color:#1c2533">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3e8ef">
<tr><td style="background:#16304f;padding:20px 28px;color:#fff;font-size:18px;font-weight:700">〰 TalentWave <span style="font-weight:400;opacity:.75">Live</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:21px;color:#16304f">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px">Équipe DataWave · ESPRIT — e-mail automatique, merci de ne pas y répondre.</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (t) => `<p style="margin:0 0 14px;line-height:1.6;font-size:15px">${t}</p>`;
const button = (href, label) => `<p style="margin:22px 0"><a href="${esc(href)}" style="background:#1f5fad;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:600;display:inline-block">${esc(label)}</a></p>`;
const box = (inner) => `<div style="background:#f3f6fb;border:1px solid #dfe6f0;border-radius:10px;padding:14px 18px;margin:16px 0">${inner}</div>`;

module.exports = {
  welcome({ firstName, loginUrl }) {
    return {
      subject: 'Bienvenue sur TalentWave Live',
      html: layout(`Bienvenue, ${firstName} !`, p('Votre compte est créé. Choisissez une offre, cliquez sur <b>Postuler</b> et déposez votre CV en PDF : l\'IA l\'analyse aussitôt.') + button(loginUrl, 'Voir les offres')),
      text: `Bienvenue ${firstName} ! Votre compte TalentWave Live est créé : ${loginUrl}`,
    };
  },

  resetPassword({ firstName, resetUrl }) {
    return {
      subject: 'Réinitialisation de votre mot de passe',
      html: layout('Mot de passe oublié', p(`Bonjour ${esc(firstName)},`) + p('Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable <b>15 minutes</b> et ne fonctionne qu\'une fois.')
        + button(resetUrl, 'Choisir un nouveau mot de passe') + p('<span style="color:#64748b;font-size:13px">Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet e-mail.</span>')),
      text: `Bonjour ${firstName}, réinitialisez votre mot de passe (15 min) : ${resetUrl}`,
    };
  },

  /** E-mail d'ACCEPTATION pour entretien : quiz + entretien avatar + lien de visioconférence. */
  invitation({ firstName, jobTitle, score, explanation, quizUrl, roomUrl, meetLink, meetProvider, scheduledAt, expiresAt, quizMinutes }) {
    const meetLabel = meetProvider === 'google' ? 'Google Meet' : 'visioconférence (Jitsi Meet)';
    return {
      subject: `Votre candidature est retenue pour un entretien — ${jobTitle}`,
      html: layout('Félicitations, vous êtes invité·e en entretien', p(`Bonjour ${esc(firstName)},`)
        + p(`Votre CV correspond au poste <b>${esc(jobTitle)}</b> avec un score de <b>${score}/100</b>.`)
        + box(explanation.map((e) => `<div style="font-size:14px;line-height:1.6">${esc(e)}</div>`).join(''))
        + p('<b>Étape 1 — Quiz de compétences</b> (' + quizMinutes + ' minutes, chronométré). Il prépare votre entretien : l\'avatar reviendra sur vos points faibles.')
        + button(quizUrl, 'Passer le quiz')
        + p(`<b>Étape 2 — Entretien vidéo de 5 minutes</b> avec notre avatar IA. Il pose 5 questions en direct et vous laisse un instant pour répondre à voix haute, en français ou en anglais. Créneau proposé : <b>${esc(fmtDate(scheduledAt))}</b> (accessible jusqu'au ${esc(fmtDate(expiresAt))}).`)
        + button(roomUrl, 'Ouvrir la salle d\'entretien')
        + box(`<div style="font-size:14px"><b>Lien ${esc(meetLabel)}</b> pour échanger avec le recruteur :<br><a href="${esc(meetLink)}" style="color:#1f5fad">${esc(meetLink)}</a></div>`)
        + p('<span style="font-size:13px;color:#64748b">Conseils : navigateur Chrome ou Edge, micro et caméra autorisés, endroit calme. Un assistant est disponible sur la plateforme pour vous entraîner.</span>')),
      text: `Bonjour ${firstName}, votre candidature (${jobTitle}) est retenue (score ${score}/100).\n1) Quiz : ${quizUrl}\n2) Entretien avatar (5 min) : ${roomUrl}\nCréneau : ${fmtDate(scheduledAt)}\n${meetLabel} : ${meetLink}`,
    };
  },

  rejection({ firstName, jobTitle, score, explanation, offersUrl }) {
    return {
      subject: `Votre candidature — ${jobTitle}`,
      html: layout('Merci pour votre candidature', p(`Bonjour ${esc(firstName)},`)
        + p(`Nous avons étudié votre CV pour le poste <b>${esc(jobTitle)}</b>. Le score de correspondance (<b>${score}/100</b>) n'atteint pas le niveau requis pour un entretien cette fois-ci.`)
        + box(`<div style="font-size:14px;line-height:1.6"><b>Pourquoi ce résultat</b><br>${explanation.map(esc).join('<br>')}</div>`)
        + p('Ces éléments sont là pour vous aider : complétez votre CV et postulez à d\'autres offres.') + button(offersUrl, 'Voir les autres offres')),
      text: `Bonjour ${firstName}, votre candidature (${jobTitle}) n'est pas retenue (score ${score}/100). ${explanation.join(' ')}`,
    };
  },

  interviewDone({ recruiterName, candidateName, jobTitle, overall, recommendation, reviewUrl }) {
    const label = { recommande: 'Recommandé', a_revoir: 'À revoir', non_recommande: 'Non recommandé' }[recommendation];
    return {
      subject: `Entretien évalué : ${candidateName} — ${jobTitle}`,
      html: layout('Un entretien attend votre décision', p(`Bonjour ${esc(recruiterName)},`)
        + p(`<b>${esc(candidateName)}</b> a terminé son entretien vidéo pour <b>${esc(jobTitle)}</b>.`)
        + box(`<div style="font-size:15px">Note globale : <b>${overall}/100</b> · Avis de l'IA : <b>${label}</b></div>`)
        + p('Transcriptions, notes par question et synthèse sont disponibles. La décision finale vous appartient.') + button(reviewUrl, 'Voir l\'entretien')),
      text: `${candidateName} (${jobTitle}) : ${overall}/100, ${label}. ${reviewUrl}`,
    };
  },

  decision({ firstName, jobTitle, retained, comment, overall }) {
    return {
      subject: retained ? `Bonne nouvelle pour le poste ${jobTitle}` : `Résultat de votre entretien — ${jobTitle}`,
      html: layout(retained ? 'Votre candidature est retenue 🎉' : 'Résultat de votre entretien', p(`Bonjour ${esc(firstName)},`)
        + p(retained
          ? `Le recruteur a validé votre entretien pour <b>${esc(jobTitle)}</b> (note ${overall}/100). Il vous contactera très prochainement pour la suite.`
          : `Après étude de votre entretien pour <b>${esc(jobTitle)}</b> (note ${overall}/100), nous ne donnons pas suite cette fois-ci.`)
        + (comment ? box(`<div style="font-size:14px"><b>Message du recruteur</b><br>${esc(comment)}</div>`) : '')
        + p('Retrouvez le détail de vos résultats dans votre espace.')),
      text: `Bonjour ${firstName}, ${retained ? 'votre candidature est retenue' : 'nous ne donnons pas suite'} (${jobTitle}). ${comment || ''}`,
    };
  },
};
