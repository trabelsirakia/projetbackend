import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Briefcase, Clock, MapPin } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Pagination from '../../components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { FilterSelect, Pill, Toolbar } from '../../components/shared';
import useFetch, { useDebounce } from '../../hooks/useFetch';
import { jobsApi } from '../../services/api';
import { APPLICATION_STATUS, METIERS, metierOptions } from '../../utils/labels';

const CONTRACTS = [{ value: '', label: 'Tous les contrats' }, ...['CDI', 'CDD', 'Stage', 'Freelance', 'Alternance'].map((v) => ({ value: v, label: v }))];
const REMOTE = [{ value: '', label: 'Tous les modes' }, { value: 'sur site', label: 'Sur site' }, { value: 'hybride', label: 'Hybride' }, { value: 'télétravail', label: 'Télétravail' }];
const SORTS = [{ value: '-createdAt', label: 'Plus récentes' }, { value: 'title', label: 'Titre A → Z' }, { value: 'minExperienceYears', label: 'Expérience croissante' }];

export default function Offers() {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ metier: '', contractType: '', remote: '', sort: '-createdAt' });
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q);
  const set = (k) => (v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };
  const { data, loading, error, reload } = useFetch((signal) => jobsApi.list({ q: debounced, ...filters, page, limit: 9 }, signal).then((r) => r.data), [debounced, filters, page]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Offres d'emploi" title="Trouvez le poste qui vous ressemble" description="Cliquez sur une offre puis sur « Postuler » : votre CV est analysé immédiatement et vous savez tout de suite si vous êtes invité·e en entretien." />
      <Toolbar search={q} onSearch={(v) => { setQ(v); setPage(1); }} placeholder="Titre, compétence, ville…">
        <FilterSelect label="Métier" value={filters.metier} onChange={set('metier')} options={metierOptions()} />
        <FilterSelect label="Contrat" value={filters.contractType} onChange={set('contractType')} options={CONTRACTS} />
        <FilterSelect label="Mode" value={filters.remote} onChange={set('remote')} options={REMOTE} />
        <FilterSelect label="Tri" value={filters.sort} onChange={set('sort')} options={SORTS} />
      </Toolbar>

      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-52" />)}</div>
      ) : !data?.items.length ? (
        <EmptyState title="Aucune offre ne correspond" description="Modifiez la recherche ou les filtres." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((job, i) => (
              <motion.div key={job.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link to={`/offres/${job.id}`} className="card card-hover flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="icon-chip bg-tw-tint text-tw-accent"><Briefcase className="size-5" /></span>
                    {job.myApplication && <Pill meta={APPLICATION_STATUS} value={job.myApplication.status} />}
                  </div>
                  <h2 className="mt-4 text-lg font-semibold leading-snug">{job.title}</h2>
                  <p className="text-sm text-tw-muted">{METIERS[job.metier]}</p>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-tw-muted">{job.description}</p>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                    {job.requiredSkills.slice(0, 4).map((s) => <span key={s} className="rounded-md bg-tw-canvas px-2 py-0.5 text-xs text-tw-muted ring-1 ring-tw-line">{s}</span>)}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-tw-line pt-3 text-xs text-tw-muted">
                    <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{job.location} · {job.remote}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{job.contractType}{job.minExperienceYears ? ` · ${job.minExperienceYears} an(s)` : ''}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
          <Pagination pagination={data.pagination} onPage={setPage} />
        </>
      )}
    </div>
  );
}
