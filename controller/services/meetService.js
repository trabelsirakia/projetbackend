/**
 * Visioconférence de l'entretien :
 *  - Google Meet RÉEL si GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN sont renseignés
 *    (npm run google:auth les obtient) : un événement Google Agenda est créé avec une conférence Meet
 *    (conferenceDataVersion=1), le candidat est invité et reçoit aussi l'invitation de Google ;
 *  - sinon, salle Jitsi Meet (visioconférence libre, sans compte) au nom unique et imprévisible.
 * Dans les deux cas, l'entretien avec l'avatar IA se passe dans la salle de la plateforme (lien dans l'e-mail) ;
 * la visio sert au recruteur qui souhaite observer ou poursuivre l'échange en direct.
 */
const crypto = require('crypto');
const env = require('../../config/env');
const logger = require('../../config/utils/logger');

async function googleAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      refresh_token: env.google.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OAuth Google : ${data.error_description || data.error || res.status}`);
  return data.access_token;
}

async function createGoogleMeet({ title, description, start, durationMinutes, attendees }) {
  const token = await googleAccessToken();
  const end = new Date(start.getTime() + Math.max(15, durationMinutes) * 60000);
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: title,
      description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      // MAIL_REDIRECT_TO : l'invitation Google Agenda part vers la même boîte unique que les e-mails.
      attendees: [...new Set(attendees.map((email) => (process.env.MAIL_REDIRECT_TO || '').trim() || email))].map((email) => ({ email })),
      conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Agenda : ${data.error?.message || res.status}`);
  const link = data.hangoutLink || data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri;
  if (!link) throw new Error('Google n\'a pas renvoyé de lien Meet');
  return { provider: 'google', link, eventId: data.id };
}

function jitsiRoom(title) {
  const slug = title.normalize('NFD').replace(/[^\w]+/g, '').slice(0, 24);
  return { provider: 'jitsi', link: `https://meet.jit.si/TalentWaveLive-${slug}-${crypto.randomBytes(6).toString('hex')}`, eventId: null };
}

async function createMeeting(params) {
  if (env.google.configured && !env.isTest && process.env.MAIL_CAPTURE !== '1') {
    try {
      return await createGoogleMeet(params);
    } catch (err) {
      logger.warn(`Google Meet indisponible (${err.message}) : salle Jitsi utilisée.`);
    }
  }
  return jitsiRoom(params.title);
}

async function cancelMeeting(meet) {
  if (meet?.provider !== 'google' || !meet.eventId || !env.google.configured) return;
  try {
    const token = await googleAccessToken();
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${meet.eventId}?sendUpdates=all`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    logger.warn(`Annulation Google Agenda impossible : ${err.message}`);
  }
}

module.exports = { createMeeting, cancelMeeting };
