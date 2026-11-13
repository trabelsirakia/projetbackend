/**
 * npm run google:auth : connecte la plateforme à VOTRE Google Agenda pour créer de vrais liens Google Meet.
 *
 * Prérequis (une seule fois, console.cloud.google.com) :
 *   1. Créer un projet, activer « Google Calendar API ».
 *   2. Écran de consentement OAuth (type « Externe », vous comme utilisateur test).
 *   3. Identifiants > ID client OAuth > type « Application de bureau ».
 *   4. Copier l'ID et le secret dans .env : GOOGLE_CLIENT_ID=…  GOOGLE_CLIENT_SECRET=…
 * Puis : npm run google:auth → le navigateur s'ouvre, vous acceptez, le refresh token est écrit dans .env.
 * Sans ces valeurs, la plateforme crée automatiquement des salles Jitsi Meet (aucun compte nécessaire).
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { exec } = require('child_process');

const ENV_FILE = path.resolve(__dirname, '..', '.env');
const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/oauth2callback`;
const text = fs.readFileSync(ENV_FILE, 'utf8');
const read = (k) => (text.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
const clientId = read('GOOGLE_CLIENT_ID');
const clientSecret = read('GOOGLE_CLIENT_SECRET');

if (!clientId || !clientSecret) {
  console.log('Renseignez d\'abord GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans .env (voir l\'en-tête de config/google-auth.js).');
  process.exit(1);
}

const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: clientId, redirect_uri: REDIRECT, response_type: 'code', access_type: 'offline', prompt: 'consent',
  scope: 'https://www.googleapis.com/auth/calendar.events',
})}`;

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const u = new URL(req.url, REDIRECT);
  if (u.pathname !== '/oauth2callback') { res.writeHead(404).end(); return; }
  const code = u.searchParams.get('code');
  if (!code) { res.end('Autorisation refusée.'); server.close(); return; }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
  });
  const data = await r.json();
  if (!data.refresh_token) {
    res.end(`Échec : ${data.error_description || data.error || 'pas de refresh token'}`);
    console.log('Échec :', data);
  } else {
    const updated = /^GOOGLE_REFRESH_TOKEN=.*$/m.test(text) ? text.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, `GOOGLE_REFRESH_TOKEN=${data.refresh_token}`) : `${text}\nGOOGLE_REFRESH_TOKEN=${data.refresh_token}\n`;
    fs.writeFileSync(ENV_FILE, updated);
    res.end('Google Agenda connecté : vous pouvez fermer cet onglet et redémarrer TalentWave Live.');
    console.log('✔ GOOGLE_REFRESH_TOKEN écrit dans .env. Redémarrez le serveur : les entretiens auront de vrais liens Google Meet.');
  }
  server.close();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Ouverture de la page d'autorisation Google…\nSi rien ne s'ouvre, copiez ce lien dans votre navigateur :\n${url}`);
  exec(`start "" "${url}"`);
});
