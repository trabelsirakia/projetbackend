const URL_API = 'http://localhost:11434/api/generate';
const MODELE = 'qwen2.5:1.5b';

// Construit le prompt en n'incluant que les champs renseignés
function construirePrompt({ titre, entreprise, lieu, contrat, competences }) {
  const infos = [
    `Poste : ${titre}`,
    entreprise && `Entreprise : ${entreprise}`,
    lieu && `Lieu : ${lieu}`,
    contrat && `Type de contrat : ${contrat}`,
    competences && `Compétences clés : ${competences}`,
  ]
    .filter(Boolean)
    .join('\n');

  const nomEntreprise = entreprise || "l'entreprise";
  const estStage = contrat && /stage|stagiaire/i.test(contrat + ' ' + titre);

  return (
    `Tu es un recruteur expert. Rédige uniquement en français l'annonce d'une offre d'emploi ` +
    `à partir des informations ci-dessous.\n\n` +
    `${infos}\n\n` +
    `Règles strictes :\n` +
    `- N'écris AUCUN en-tête récapitulatif (pas de lignes "Poste :", "Entreprise :", "Lieu :", "Contrat :", "Compétences :").\n` +
    `- N'invente aucune information : ni salaire, ni avantages, ni chiffres, ni années d'expérience.\n` +
    (estStage ? `- C'est un stage : ne demande pas d'expérience professionnelle.\n` : '') +
    `- Ne décris pas ${nomEntreprise} au-delà de son nom.\n` +
    `- Ton professionnel et engageant, 100 à 150 mots.\n` +
    `- Utilise exactement ces trois titres, chacun suivi de son contenu :\n` +
    `À propos du poste (2 à 3 phrases)\n` +
    `Missions (4 à 5 puces commençant par "- ")\n` +
    `Profil recherché (3 à 4 puces commençant par "- ", basées sur les compétences données)\n` +
    `- Termine par une phrase invitant à postuler.\n` +
    `Réponds uniquement avec l'annonce, sans commentaire avant ou après.`
  );
}

// Nettoie le texte renvoyé par le modèle
function nettoyer(texte) {
  return texte
    .split('\n')
    // supprime les lignes d'en-tête récapitulatif ou "non précisé(e)"
    .filter((ligne) => {
      const l = ligne.trim();
      if (/^(titre|poste|entreprise|lieu|type de contrat|contrat|comp[ée]tences|structure)\s*:/i.test(l)) {
        return false;
      }
      if (/non\s+pr[ée]cis[ée]e?s?/i.test(l)) return false;
      return true;
    })
    .join('\n')
    .replace(/\*\*/g, '') // retire le gras markdown
    .replace(/\n{3,}/g, '\n\n') // évite les grands vides
    .trim();
}

async function genererDescription({ titre, entreprise, lieu, contrat, competences }) {
  // Texte de secours si l'IA ne répond pas
  const secours =
    `${entreprise || 'Notre entreprise'} recrute un(e) ${titre}` +
    `${lieu ? ' à ' + lieu : ''}${contrat ? ' (' + contrat + ')' : ''}. ` +
    `${competences ? 'Compétences recherchées : ' + competences + '. ' : ''}` +
    `Envoyez votre candidature pour rejoindre notre équipe.`;

  try {
    const prompt = construirePrompt({ titre, entreprise, lieu, contrat, competences });

    const reponse = await fetch(URL_API, {
      method: 'POST',
      signal: AbortSignal.timeout(120000), // arrêt après 2 minutes
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELE,
        prompt,
        stream: false,
        keep_alive: '30m', // garde le modèle en mémoire entre deux appels
        options: {
          temperature: 0.4, // moins d'invention
          top_p: 0.9,
          repeat_penalty: 1.1,
          num_predict: 500, // assez long pour ne pas couper le texte
        },
      }),
    });

    if (!reponse.ok) throw new Error('Erreur Ollama : ' + reponse.status);

    const data = await reponse.json();
    const brut = data?.response;
    if (!brut) throw new Error('Réponse IA vide');

    const texte = nettoyer(brut);
    if (!texte) throw new Error('Réponse IA inutilisable après nettoyage');

    return { texte, source: 'ia' };
  } catch (erreur) {
    console.error('IA indisponible :', erreur.message);
    return { texte: secours, source: 'secours' };
  }
}

module.exports = { genererDescription };