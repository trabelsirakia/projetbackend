const CandidateRanking = require('../models/candidateRanking');
const MatchResult = require('../models/matchResult');

/**
 * Génère automatiquement le classement pour tous les candidats d'un job donné.
 * URL : POST /candidateRanking/generateranking/:jobId
 */
async function generateRankingsByJob(req, res) {
  try {
    const { jobId } = req.params;

    // 1. Récupérer tous les résultats non éliminés pour ce poste, triés par score décroissant
    const matches = await MatchResult.find({ jobId, eliminated: false }).sort({ totalScore: -1 });

    if (matches.length === 0) {
      return res.status(404).send('Aucun candidat éligible trouvé pour ce poste');
    }

    // 2. Supprimer les anciens classements pour ce poste pour éviter les doublons
    await CandidateRanking.deleteMany({ jobId });

    // 3. Créer les nouveaux classements
    const rankingsToInsert = matches.map((match, index) => {
      const rank = index + 1;
      const isTop5 = rank <= 5;
      return {
        matchResultId: match._id,
        jobId: match.jobId,
        candidateId: match.candidateId,
        rank: rank,
        score: match.totalScore,
        isTop5: isTop5,
        invitationStatus: isTop5 ? 'INVITED' : 'NOT_INVITED',
        invitedAt: isTop5 ? new Date() : null,
      };
    });

    const createdRankings = await CandidateRanking.insertMany(rankingsToInsert);

    res.status(201).json({
      message: `Classement généré avec succès pour ${jobId}`,
      totalRanked: createdRankings.length,
      top5Count: createdRankings.filter((r) => r.isTop5).length,
      rankings: createdRankings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Crée un nouveau CandidateRanking.
 */
async function createCandidateRanking(req, res) {
  try {
    const ranking = new CandidateRanking(req.body);
    await ranking.save();
    res.status(201).json(ranking);
  } catch (err) {
    console.error(err);
    res.status(400).send(err.message);
  }
}

/**
 * Retourne tous les CandidateRanking.
 */
async function getAllCandidateRankings(req, res) {
  try {
    const rankings = await CandidateRanking.find().populate('matchResultId');
    res.status(200).json(rankings);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Exemple A : Tri par Rang croissant (du Top 1 au dernier rang)
 */
async function sortByRankAsc(req, res) {
  try {
    const sorted = await CandidateRanking.find().sort({ rank: 1 }).populate('matchResultId');
    res.status(200).json(sorted);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Exemple B : Tri par Score décroissant (du plus haut score au plus bas)
 */
async function sortByScoreDesc(req, res) {
  try {
    const sorted = await CandidateRanking.find().sort({ score: -1 }).populate('matchResultId');
    res.status(200).json(sorted);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Exemple C : Tri par candidateId alphabétique (A -> Z)
 */
async function sortByCandidateIdAsc(req, res) {
  try {
    const sorted = await CandidateRanking.find().sort({ candidateId: 1 }).populate('matchResultId');
    res.status(200).json(sorted);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Retourne les CandidateRanking filtrés.
 * Query params (optionnels) :
 *   - jobId (string)
 *   - candidateId (string)
 *   - invitationStatus (string)
 *   - isTop5 (boolean)
 */
async function getCandidateRankingsFiltered(req, res) {
  try {
    const { jobId, candidateId, invitationStatus, isTop5 } = req.query;
    const filter = {};
    if (jobId) filter.jobId = jobId;
    if (candidateId) filter.candidateId = candidateId;
    if (invitationStatus) filter.invitationStatus = invitationStatus;
    if (isTop5 !== undefined) filter.isTop5 = isTop5 === 'true';
    const results = await CandidateRanking.find(filter).populate('matchResultId');
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Recherche texte libre dans CandidateRanking (candidateId, invitationStatus).
 */
async function searchCandidateRankings(req, res) {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).send('Query parameter "q" is required');
    const regex = new RegExp(q, 'i');
    const filter = { $or: [{ candidateId: regex }, { invitationStatus: regex }] };
    const results = await CandidateRanking.find(filter).populate('matchResultId');
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Retourne un CandidateRanking par son id.
 */
async function getCandidateRankingById(req, res) {
  try {
    const ranking = await CandidateRanking.findById(req.params.id).populate('matchResultId');
    if (!ranking) return res.status(404).send('CandidateRanking not found');
    res.status(200).json(ranking);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

/**
 * Met à jour un CandidateRanking.
 */
async function updateCandidateRanking(req, res) {
  try {
    const updated = await CandidateRanking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).send('CandidateRanking not found');
    res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    res.status(400).send(err.message);
  }
}

/**
 * Supprime un CandidateRanking.
 */
async function deleteCandidateRanking(req, res) {
  try {
    const removed = await CandidateRanking.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).send('CandidateRanking not found');
    res.status(200).send('CandidateRanking deleted');
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}

module.exports = {
  createCandidateRanking,
  generateRankingsByJob,
  getAllCandidateRankings,
  sortByRankAsc,
  sortByScoreDesc,
  sortByCandidateIdAsc,
  getCandidateRankingsFiltered,
  searchCandidateRankings,
  getCandidateRankingById,
  updateCandidateRanking,
  deleteCandidateRanking,
};
