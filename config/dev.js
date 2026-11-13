/**
 * npm run dev : lance l'API (nodemon, port 8200) et l'interface (Vite, port 5175) ensemble.
 * Ctrl+C arrête les deux. Pour n'en lancer qu'un : npm run dev:api / npm run dev:web.
 */
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const bin = (...p) => path.join(ROOT, 'node_modules', ...p);
const processes = [
  { name: 'api', color: 36, args: [bin('nodemon', 'bin', 'nodemon.js'), 'app.js'] },
  { name: 'web', color: 35, args: [bin('vite', 'bin', 'vite.js'), '--config', 'config/vite.config.mjs'] },
];

const children = processes.map(({ name, color, args }) => {
  const child = spawn(process.execPath, args, { cwd: ROOT, env: process.env });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      lines.forEach((line) => out.write(`${prefix}${line}\n`));
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${prefix}arrêté (code ${code})\n`);
    shutdown(code || 0);
  });
  return child;
});

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  children.forEach((c) => { if (c.exitCode === null) c.kill(); });
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
