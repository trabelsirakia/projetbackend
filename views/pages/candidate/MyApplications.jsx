import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, Video } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { FilterSelect, Pill } from '../../components/shared';
import useFetch from '../../hooks/useFetch';
import { applicationsApi } from '../../services/api';
import { APPLICATION_STATUS, fmtDay, scoreTone } from '../../utils/labels';

const STATUS_OPTIONS = [{ value: '', label: 'Tous les statuts' }, ...Object.entries(APPLICATION_STATUS).map(([value, m]) => ({ value, label: m.label }))];

/** Prochaine action proposée au candidat selon l'étape. */
export function NextAction({ app }) {
  if (app.status === 'invitee') return <Link to={`/quiz/${app.id}`}><Button size="sm" icon={ClipboardCheck}>Passer le quiz</Button></Link>;
  if (app.status === 'quiz_termine' && app.interview) {
    const id = app.interview.id || app.interview._id || app.interview;
    return <Link to={`/entretien/${id}`}><Button size="sm" icon={Video}>Passer l'entretien</Button></Link>;
  }
  return <Link to={`/mes-candidatures/${app.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-tw-accent hover:underline">Détails <ArrowRight className="size-3.5" /></Link>;
}

export default function MyApplications() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch((signal) => applicationsApi.list({ status, page, limit: 10, sort: '-createdAt' }, signal).then((r) => r.data), [status, page]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Mon espace" title="Mes candidatures" description="Suivez chaque étape : analyse du CV, quiz, entretien avec l'avatar et décision du recruteur."
        actions={<FilterSelect label="Statut" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} />} />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-64" /> : !data.items.length ? (
        <EmptyState title="Aucune candidature pour l'instant" description="Choisissez une offre et cliquez sur « Postuler »." action={<Link to="/offres"><Button>Voir les offres</Button></Link>} />
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((app) => (
              <li key={app.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <Link to={`/mes-candidatures/${app.id}`} className="font-semibold hover:text-tw-accent">{app.job?.title}</Link>
                  <p className="mt-0.5 text-xs text-tw-muted">Déposée le {fmtDay(app.createdAt)} · {app.job?.location}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Pill meta={APPLICATION_STATUS} value={app.status} />
                    <span className="text-xs text-tw-muted">Matching <strong className={scoreTone(app.matching?.score)}>{app.matching?.score}/100</strong></span>
                    {app.quizAttempt && <span className="text-xs text-tw-muted">· Quiz <strong className={scoreTone(app.quizAttempt.percent)}>{app.quizAttempt.percent}/100</strong></span>}
                    {app.interview?.status === 'evalue' && <span className="text-xs text-tw-muted">· Entretien évalué</span>}
                  </div>
                </div>
                <NextAction app={app} />
              </li>
            ))}
          </ul>
          <Pagination pagination={data.pagination} onPage={setPage} />
        </>
      )}
    </div>
  );
}
