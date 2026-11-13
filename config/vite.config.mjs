import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import dotenv from 'dotenv';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Interface React : source dans views/, compilée dans public/ (servi par app.js).
 * En développement, Vite (port 5173) relaie /api vers le backend : même origine,
 * donc le cookie httpOnly du refresh token fonctionne sans souci CORS.
 * Le .env racine (secrets du serveur, NODE_ENV=development) n'est PAS chargé par Vite : sinon React serait
 * compilé en mode développement et des secrets pourraient fuiter. On n'y lit que VITE_API_TARGET, sans effet de bord.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(ROOT, '.env');
const fileEnv = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};

export default defineConfig(() => {
  const target = process.env.VITE_API_TARGET || fileEnv.VITE_API_TARGET || 'http://localhost:8200';
  return {
    root: path.join(ROOT, 'views'),
    envDir: path.join(ROOT, 'views'), // aucun .env ici : rien n'est injecté dans le code client
    publicDir: path.join(ROOT, 'views', 'static'),
    cacheDir: path.join(ROOT, 'node_modules', '.vite'),
    plugins: [react(), tailwindcss()],
    build: {
      outDir: path.join(ROOT, 'public'),
      emptyOutDir: true,
    },
    server: {
      port: 5175,
      strictPort: true,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/api-docs': { target, changeOrigin: true },
      },
    },
  };
});
