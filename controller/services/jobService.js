const Job = require('../../models/Job');
const Application = require('../../models/Application');
const AppError = require('../../config/utils/AppError');
const { paginate, compact, range, accentInsensitive } = require('../../config/utils/listQuery');

const SORTS = ['createdAt', 'title', 'minExperienceYears', 'matchThreshold', 'location'];

async function list(query, user) {
  const isStaff = user && ['recruteur', 'admin'].includes(user.role);
  const result = await paginate(Job, query, {
    searchFields: ['title', 'description', 'requiredSkills', 'location'],
    sortFields: SORTS,
    defaultSort: '-createdAt',
    // Les candidats (et visiteurs) ne voient que les offres publiées.
    baseFilter: isStaff ? {} : { status: 'publiee' },
    filters: (q) => compact({
      metier: q.metier,
      contractType: q.contractType,
      remote: q.remote,
      status: isStaff ? q.status : undefined,
      location: q.location ? new RegExp(`^${accentInsensitive(q.location)}`, 'i') : undefined,
      minExperienceYears: range(undefined, q.maxExperience),
      recruiter: q.mine === 'true' && user ? user._id : undefined,
    }),
  });
  // Le candidat voit s'il a déjà postulé.
  if (user?.role === 'candidat' && result.items.length) {
    const mine = await Application.find({ candidate: user._id, job: { $in: result.items.map((j) => j._id) } }).select('job status');
    const byJob = new Map(mine.map((a) => [String(a.job), a]));
    result.items = result.items.map((j) => ({ ...j.toJSON(), myApplication: byJob.has(String(j._id)) ? { id: String(byJob.get(String(j._id))._id), status: byJob.get(String(j._id)).status } : null }));
  }
  return result;
}

async function get(id, user) {
  const job = await Job.findById(id).populate('recruiter', 'firstName lastName');
  if (!job || (job.status !== 'publiee' && !['recruteur', 'admin'].includes(user?.role))) throw new AppError('Offre introuvable.', 404, 'JOB_NOT_FOUND');
  const out = job.toJSON();
  if (user?.role === 'candidat') {
    const app = await Application.findOne({ candidate: user._id, job: job._id }).select('status matching');
    out.myApplication = app ? { id: String(app._id), status: app.status, score: app.matching?.score } : null;
  }
  return out;
}

const create = (data, user) => Job.create({ ...data, recruiter: user._id });

async function update(id, data, user) {
  const job = await Job.findById(id);
  if (!job) throw new AppError('Offre introuvable.', 404, 'JOB_NOT_FOUND');
  if (user.role !== 'admin' && String(job.recruiter) !== String(user._id)) throw new AppError('Seul le recruteur de l\'offre peut la modifier.', 403, 'FORBIDDEN');
  Object.assign(job, data);
  return job.save();
}

async function remove(id, user) {
  const job = await Job.findById(id);
  if (!job) throw new AppError('Offre introuvable.', 404, 'JOB_NOT_FOUND');
  if (user.role !== 'admin' && String(job.recruiter) !== String(user._id)) throw new AppError('Seul le recruteur de l\'offre peut la supprimer.', 403, 'FORBIDDEN');
  if (await Application.exists({ job: id })) {
    throw new AppError('Des candidatures existent pour cette offre : fermez-la plutôt que de la supprimer.', 409, 'JOB_HAS_APPLICATIONS');
  }
  await job.deleteOne();
}

module.exports = { list, get, create, update, remove };
