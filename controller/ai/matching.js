/**
 * JOB MATCHING (au clic sur « Postuler ») : score 0-100 entre le CV (PDF → texte) et l'offre, expliqué.
 *
 * Quatre composantes, toutes calculées et justifiées :
 *  1. Compétences (45 %) : chaque compétence exigée est cherchée dans le CV
 *       a) littéralement (nom + variantes du catalogue métier, frontières de mots Unicode) → preuve = la ligne du CV ;
 *       b) sinon sémantiquement : similarité cosinus (MiniLM multilingue) entre la compétence et chaque phrase du CV ;
 *          au-delà du seuil, crédit partiel proportionnel. Les compétences « souhaitées » comptent pour moitié.
 *  2. Sémantique (25 %) : chaque phrase de la description de l'offre est rapprochée de la phrase du CV la plus proche
 *     (moyenne des maxima, recalée sur l'échelle utile du modèle).
 *  3. Expérience (20 %) : années déclarées (« 3 ans d'expérience », « 5+ years ») ou périodes datées (2019 – 2022,
 *     2021 – aujourd'hui) fusionnées sans double compte ; rapportées au minimum demandé.
 *  4. Langues (10 %) : langues exigées retrouvées dans le CV.
 * Si le modèle d'embeddings est indisponible, la composante sémantique est retirée et les poids renormalisés.
 */
const hf = require('./hfModels');
const { METIERS } = require('./data/metiers');
const { containsTerm, sentences, clamp01, round } = require('./textUtils');

const WEIGHTS = { skills: 0.45, semantic: 0.25, experience: 0.2, languages: 0.1 };
const SKILL_SIM_THRESHOLD = 0.6;

const LANGUAGES = {
  'français': ['français', 'francais', 'french'],
  anglais: ['anglais', 'english'],
  arabe: ['arabe', 'arabic'],
  allemand: ['allemand', 'german', 'deutsch'],
  espagnol: ['espagnol', 'spanish'],
  italien: ['italien', 'italian'],
};

function aliasesFor(skill, metier) {
  const canon = skill.toLowerCase();
  const entry = (METIERS[metier]?.skills || []).find((s) => s.name.toLowerCase() === canon || s.aliases.includes(canon));
  return [...new Set([skill, ...(entry ? [entry.name, ...entry.aliases] : [])].map((a) => a.toLowerCase()))];
}

// ---------- Expérience ----------
const NOW_WORDS = /(aujourd'hui|aujourd’hui|présent|present|actuel|en cours|now|current)/i;

function experienceYears(text) {
  let declared = 0;
  const declaredRe = /(\d{1,2})\s*\+?\s*(?:ans|années|years?)\s+(?:d['’]\s*)?(?:expérience|experience|of experience)/giu;
  for (const m of text.matchAll(declaredRe)) declared = Math.max(declared, Number(m[1]));

  const year = new Date().getFullYear();
  const ranges = [];
  const rangeRe = /((?:19|20)\d{2})\s*(?:-|–|—|à|to|au)\s*((?:19|20)\d{2}|aujourd['’]hui|présent|present|actuel|en cours|now|current)/giu;
  for (const m of text.matchAll(rangeRe)) {
    const start = Number(m[1]);
    const end = NOW_WORDS.test(m[2]) ? year : Number(m[2]);
    if (end >= start && end <= year && start >= 1980) ranges.push([start, end === start ? end + 0.5 : end]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur = null;
  for (const r of ranges) {
    if (!cur || r[0] > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [...r]; } else cur[1] = Math.max(cur[1], r[1]);
  }
  if (cur) total += cur[1] - cur[0];
  return round(Math.max(declared, total), 1);
}

// ---------- Score ----------
async function match({ cvText, job }) {
  const cvSentences = sentences(cvText, { min: 2, max: 50 });
  const lines = cvText.split('\n').map((l) => l.trim()).filter(Boolean);
  const evidenceLine = (aliases) => {
    const line = lines.find((l) => aliases.some((a) => containsTerm(l, a)));
    return line ? line.slice(0, 160) : '';
  };

  const required = job.requiredSkills || [];
  const nice = job.niceToHaveSkills || [];
  const all = [...required.map((s) => ({ s, w: 1, required: true })), ...nice.map((s) => ({ s, w: 0.5, required: false }))];

  // Embeddings (compétences non trouvées littéralement + phrases du CV + phrases de l'offre).
  const literal = all.map(({ s }) => {
    const aliases = aliasesFor(s, job.metier);
    const found = aliases.some((a) => containsTerm(cvText, a));
    return { found, evidence: found ? evidenceLine(aliases) : '' };
  });
  const jobSentences = sentences(job.description, { min: 4, max: 50 }).slice(0, 25);
  const toEmbed = [...all.map(({ s }) => s), ...cvSentences, ...jobSentences];
  const vectors = cvSentences.length ? await hf.embed(toEmbed) : null;
  const semanticAvailable = Boolean(vectors);

  const skillVec = vectors ? vectors.slice(0, all.length) : [];
  const cvVec = vectors ? vectors.slice(all.length, all.length + cvSentences.length) : [];
  const jobVec = vectors ? vectors.slice(all.length + cvSentences.length) : [];

  const bestCv = (v) => {
    let best = { sim: 0, i: -1 };
    cvVec.forEach((c, i) => { const sim = hf.cosine(v, c); if (sim > best.sim) best = { sim, i }; });
    return best;
  };

  // 1. Compétences
  let gained = 0;
  let possible = 0;
  const matchedSkills = [];
  const missingSkills = [];
  all.forEach(({ s, w, required: isRequired }, idx) => {
    possible += w;
    if (literal[idx].found) {
      gained += w;
      matchedSkills.push({ skill: s, evidence: literal[idx].evidence, similarity: 1 });
      return;
    }
    if (semanticAvailable) {
      const best = bestCv(skillVec[idx]);
      if (best.sim >= SKILL_SIM_THRESHOLD) {
        const credit = clamp01((best.sim - SKILL_SIM_THRESHOLD) / 0.25) * 0.5 + 0.5;
        gained += w * credit;
        matchedSkills.push({ skill: s, evidence: cvSentences[best.i].slice(0, 160), similarity: round(best.sim, 3) });
        return;
      }
    }
    if (isRequired) missingSkills.push(s);
  });
  const skills = possible ? gained / possible : 1;

  // 2. Sémantique
  let semantic = null;
  if (semanticAvailable && jobVec.length && cvVec.length) {
    const sims = jobVec.map((v) => bestCv(v).sim);
    const mean = sims.reduce((a, b) => a + b, 0) / sims.length;
    semantic = clamp01((mean - 0.2) / 0.55);
  }

  // 3. Expérience
  const years = experienceYears(cvText);
  const need = job.minExperienceYears || 0;
  const experience = need === 0 ? 1 : clamp01(years / need);

  // 4. Langues
  const wanted = (job.languages || []).map((l) => l.toLowerCase());
  const languagesFound = Object.entries(LANGUAGES).filter(([, al]) => al.some((a) => containsTerm(cvText, a))).map(([k]) => k);
  const languages = wanted.length ? wanted.filter((l) => languagesFound.includes(l) || (LANGUAGES[l] || [l]).some((a) => containsTerm(cvText, a))).length / wanted.length : 1;

  const parts = { skills, semantic, experience, languages };
  const active = Object.entries(WEIGHTS).filter(([k]) => parts[k] !== null);
  const totalW = active.reduce((a, [, w]) => a + w, 0);
  const score = Math.round(100 * active.reduce((a, [k, w]) => a + parts[k] * w, 0) / totalW);

  const reqMatched = matchedSkills.filter((m) => required.includes(m.skill)).length;
  const explanation = [
    `+ ${reqMatched} compétence${reqMatched > 1 ? 's' : ''} obligatoire${reqMatched > 1 ? 's' : ''} sur ${required.length}, chacune prouvée par une phrase du CV.`,
  ];
  const minus = [];
  if (missingSkills.length) minus.push(`${missingSkills.slice(0, 3).join(', ')} demandé${missingSkills.length > 1 ? 's' : ''} mais absent${missingSkills.length > 1 ? 's' : ''}`);
  if (need && years < need) minus.push(`${years} an${years >= 2 ? 's' : ''} d'expérience sur ${need} attendu${need > 1 ? 's' : ''}`);
  if (languages < 1) minus.push(`langue${wanted.length > 1 ? 's' : ''} demandée${wanted.length > 1 ? 's' : ''} non trouvée${wanted.length > 1 ? 's' : ''} (${wanted.filter((l) => !languagesFound.includes(l)).join(', ')})`);
  if (minus.length) explanation.push(`– ${minus.join(' ; ')}.`);
  if (semantic !== null) explanation.push(`Proximité du parcours avec la description du poste : ${Math.round(semantic * 100)}/100.`);
  else explanation.push('Modèle sémantique indisponible : score calculé sans la composante sémantique.');

  return {
    score,
    breakdown: {
      skills: Math.round(skills * 100),
      semantic: semantic === null ? null : Math.round(semantic * 100),
      experience: Math.round(experience * 100),
      languages: Math.round(languages * 100),
    },
    matchedSkills,
    missingSkills,
    experienceYears: years,
    languagesFound,
    explanation,
    method: semanticAvailable ? `règles + ${hf.REGISTRY.embeddings.source}` : 'règles seules (mode dégradé)',
    computedAt: new Date(),
  };
}

module.exports = { match, experienceYears, WEIGHTS };
