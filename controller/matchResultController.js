const MatchResult = require('../models/matchResult');
const duplicateService = require('../services/duplicate.service');

/**
 * Crée un nouveau MatchResult.
 */
async function createMatchResult(req, res) {
  try {
    const mr = new MatchResult(req.body);
    await mr.save();
    res.status(201).json(mr);
  } catch (err) {
    console.error(err);
    res.status(400).send(err.message);
  }
}

/**
 * Retourne tous les MatchResult.
 */
async function getAllMatchResults(req, res) {
  try {
    const results = await MatchResult.find();
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Retourne les MatchResult filtrés.
 * Query params (optionnels) :
 *   - status (string)            – ex. 'PENDING', 'SHORTLISTED'
 *   - jobId (string)
 *   - candidateId (string)
 *   - eliminated (boolean)       – 'true' ou 'false'
 *   - isActive (boolean)         – 'true' ou 'false'
 *   - minScore (number)          – score minimum (totalScore)
 *   - maxScore (number)          – score maximum (totalScore)
 */
async function getMatchResultsFiltered(req, res) {
  try {
    const {
      status,
      jobId,
      candidateId,
      eliminated,
      isActive,
      minScore,
      maxScore,
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (jobId) filter.jobId = jobId;
    if (candidateId) filter.candidateId = candidateId;
    if (eliminated !== undefined) filter.eliminated = eliminated === 'true';
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (minScore !== undefined || maxScore !== undefined) {
      filter.totalScore = {};
      if (minScore !== undefined) filter.totalScore.$gte = Number(minScore);
      if (maxScore !== undefined) filter.totalScore.$lte = Number(maxScore);
    }

    const results = await MatchResult.find(filter);
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Recherche des MatchResult par texte libre.
 * Query param:
 *   - q (string) – texte à rechercher dans cvId, jobId, candidateId, explanation.notes
 */
async function searchMatchResults(req, res) {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).send('Query parameter "q" is required');

    const regex = new RegExp(q, 'i'); // case‑insensitive
    const filter = {
      $or: [
        { cvId: regex },
        { jobId: regex },
        { candidateId: regex },
        { 'explanation.notes': regex },
      ],
    };

    const results = await MatchResult.find(filter);
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Exemple A : Tri par score décroissant (du plus élevé au plus faible)
 */
async function sortByScoreDesc(req, res) {
  try {
    const sorted = await MatchResult.find().sort({ totalScore: -1 });
    res.status(200).json(sorted);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Exemple B : Tri par score croissant (du plus faible au plus élevé)
 */
async function sortByScoreAsc(req, res) {
  try {
    const sorted = await MatchResult.find().sort({ totalScore: 1 });
    res.status(200).json(sorted);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Exemple C : Tri par cvId alphabétique (A -> Z)
 */
async function sortByCvIdAsc(req, res) {
  try {
    const sorted = await MatchResult.find().sort({ cvId: 1 });
    res.status(200).json(sorted);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Retourne un MatchResult par son id.
 */
async function getMatchResultById(req, res) {
  try {
    const result = await MatchResult.findById(req.params.id);
    if (!result) return res.status(404).send('MatchResult not found');
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Met à jour un MatchResult.
 */
async function updateMatchResult(req, res) {
  try {
    const updated = await MatchResult.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).send('MatchResult not found');
    res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    res.status(400).send(err.message);
  }
}

/**
 * Supprime un MatchResult.
 */
async function deleteMatchResult(req, res) {
  try {
    const removed = await MatchResult.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).send('MatchResult not found');
    res.status(200).send('MatchResult deleted');
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}














// ============================================================
// FONCTIONS METIER : Doublons (via duplicate.service.js)
// ============================================================

/**
 * Résoudre les doublons pour UN candidat et UN poste
 * POST /matchResult/resolveduplicates
 * Body : { "candidateId": "CAND-001", "jobId": "JOB-DEV-NODE" }
 */
async function resolveduplicates(req, res) {
  try {
    const { candidateId, jobId } = req.body;
    if (!candidateId || !jobId) {
      return res.status(400).send('candidateId et jobId sont requis');
    }
    const result = await duplicateService.resolveDuplicates(candidateId, jobId);
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Scanner TOUS les doublons existants dans la base
 * GET /matchResult/scanduplicates
 */
async function scanduplicates(req, res) {
  try {
    const result = await duplicateService.scanAllDuplicates();
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}



















module.exports = {
  createMatchResult,
  getAllMatchResults,
  sortByScoreDesc,
  sortByScoreAsc,
  sortByCvIdAsc,
  getMatchResultsFiltered,
  searchMatchResults,
  getMatchResultById,
  updateMatchResult,
  deleteMatchResult,
  resolveduplicates,
  scanduplicates,
};



