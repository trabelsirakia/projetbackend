/**
 * npm run models : télécharge (une seule fois) et vérifie les modèles pré-entraînés utilisés localement.
 *  - Hugging Face : embeddings multilingues + Whisper (dans config/models-cache) ;
 *  - Ollama : llama3.1:8b (chatbot, notation des réponses, génération de questions) — « ollama pull » si absent.
 */
const { execSync } = require('child_process');
const env = require('../../config/env');
const hf = require('./hfModels');

(async () => {
  for (const key of Object.keys(hf.REGISTRY)) {
    const started = Date.now();
    process.stdout.write(`- ${hf.REGISTRY[key].source} … `);
    const pipe = await hf.get(key);
    if (!pipe) {
      console.log(`ÉCHEC (${hf.status().find((s) => s.key === key).error})`);
      process.exitCode = 1;
      continue;
    }
    if (key === 'embeddings') {
      const [a, b] = await hf.embed(['Je développe des API avec Node.js', 'I build APIs with Node.js']);
      console.log(`OK en ${((Date.now() - started) / 1000).toFixed(1)} s (similarité fr/en : ${hf.cosine(a, b).toFixed(3)})`);
    } else {
      const silence = new Float32Array(16000);
      await hf.transcribe(silence, null);
      console.log(`OK en ${((Date.now() - started) / 1000).toFixed(1)} s`);
    }
  }
  try {
    const list = execSync('ollama list', { encoding: 'utf8' });
    if (!list.includes(env.ollama.model.split(':')[0])) {
      console.log(`- Ollama : téléchargement de ${env.ollama.model} …`);
      execSync(`ollama pull ${env.ollama.model}`, { stdio: 'inherit' });
    } else {
      console.log(`- Ollama : ${env.ollama.model} déjà installé`);
    }
  } catch {
    console.log('- Ollama introuvable : installez-le depuis https://ollama.com puis relancez « npm run models ».');
  }
  await hf.shutdown();
})();
