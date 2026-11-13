/** Tableau de bord global (recruteur / admin) : entonnoir de recrutement et chiffres clés. */
const Application = require('../../models/Application');
const Job = require('../../models/Job');
const User = require('../../models/User');
const Quiz = require('../../models/Quiz');
const Interview = require('../../models/Interview');

const FUNNEL = ['soumise', 'invitee', 'quiz_termine', 'entretien_termine', 'retenue'];
const REACHED = {
  soumise: null, invitee: ['invitee', 'quiz_termine', 'entretien_termine', 'retenue', 'non_retenue'], quiz_termine: ['quiz_termine', 'entretien_termine', 'retenue', 'non_retenue'],
  entretien_termine: ['entretien_termine', 'retenue', 'non_retenue'], retenue: ['retenue'],
};

async function overview() {
  const [jobs, candidates, quizzes, interviews, byStatus, avgMatch, perJob] = await Promise.all([
    Job.countDocuments({ status: 'publiee' }),
    User.countDocuments({ role: 'candidat' }),
    Quiz.countDocuments({ status: 'actif' }),
    Interview.countDocuments({}),
    Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Application.aggregate([{ $group: { _id: null, avg: { $avg: '$matching.score' } } }]),
    Application.aggregate([{ $group: { _id: '$job', count: { $sum: 1 }, avg: { $avg: '$matching.score' } } }, { $sort: { count: -1 } }, { $limit: 6 },
      { $lookup: { from: 'jobs', localField: '_id', foreignField: '_id', as: 'job' } }, { $unwind: '$job' }]),
  ]);
  const count = (statuses) => byStatus.filter((s) => !statuses || statuses.includes(s._id)).reduce((a, s) => a + s.count, 0);
  return {
    totals: { publishedJobs: jobs, candidates, activeQuizzes: quizzes, interviews, applications: count(null), averageMatching: Math.round(avgMatch[0]?.avg || 0) },
    funnel: FUNNEL.map((step) => ({ step, count: count(REACHED[step]) })),
    byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
    perJob: perJob.map((p) => ({ id: String(p._id), title: p.job.title, applications: p.count, averageMatching: Math.round(p.avg || 0) })),
  };
}

module.exports = { overview };
