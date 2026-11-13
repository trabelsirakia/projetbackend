const MatchResult = require('../models/matchResult');
const CandidateRanking = require('../models/candidateRanking');

// 1. Règle de comparaison : TotalScore > Technique > Date
function compare(a, b) {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  if ((b.scores?.technique || 0) !== (a.scores?.technique || 0)) {
    return (b.scores?.technique || 0) - (a.scores?.technique || 0);
  }
  return new Date(b.createdAt) - new Date(a.createdAt);
}

// 2. Résolution des doublons (Métier PDF)
async function resolveDuplicates(candidateId, jobId) {
  // Récupérer les CVs actifs du candidat sur ce poste
  const results = await MatchResult.find({
    candidateId,
    jobId,
    isActive: true,
    eliminated: false,
    status: { $ne: 'REJECTED' },
  });

  if (results.length < 2) return { duplicates: 0, message: 'Aucun doublon' };

  // Trier pour trouver le gagnant et les perdants
  results.sort(compare);
  const [winner, ...losers] = results;
  const loserIds = losers.map((l) => l._id);

  // Mémoriser l'invitation si un perdant était déjà invité
  const invitedLoser = await CandidateRanking.findOne({
    matchResultId: { $in: loserIds },
    invitationStatus: { $ne: 'NOT_INVITED' },
  });

  // Rejeter les perdants (traçabilité avec duplicateOf)
  await MatchResult.updateMany(
    { _id: { $in: loserIds } },
    {
      status: 'REJECTED',
      isActive: false,
      duplicateOf: winner._id,
      'explanation.notes': `Doublon : remplacé par ${winner._id}`,
    }
  );

  // Supprimer les perdants du classement
  await CandidateRanking.deleteMany({ matchResultId: { $in: loserIds } });

  // Transférer l'invitation au gagnant si nécessaire
  if (invitedLoser) {
    await CandidateRanking.updateOne(
      { matchResultId: winner._id },
      {
        invitationStatus: invitedLoser.invitationStatus,
        invitedAt: invitedLoser.invitedAt,
      }
    );
  }

  return {
    duplicates: losers.length,
    kept: winner._id,
    winner: winner,
    losers: losers,
  };
}

// 3. Scan global de tous les doublons
async function scanAllDuplicates() {
  const groups = await MatchResult.aggregate([
    { $match: { isActive: true, status: { $ne: 'REJECTED' } } },
    { $group: { _id: { candidateId: '$candidateId', jobId: '$jobId' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  return { totalGroupsWithDuplicates: groups.length, groups };
}

module.exports = { resolveDuplicates, scanAllDuplicates };
