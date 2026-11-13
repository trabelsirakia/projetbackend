import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, FileText, MailCheck, XCircle } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { FilterSelect, MatchingCard, Pill, SortHeader, Toolbar } from '../../components/shared';
import useFetch from '../../hooks/useFetch';
import useListState from '../../hooks/useListState';
import { applicationsApi, jobsApi } from '../../services/api';
import { errorMessage } from '../../services/client';
import { APPLICATION_STATUS, fmtDate, scoreTone } from '../../utils/labels';

export default function Applications() {
  const list = useListState({ sort: '-createdAt', filters: { status: '', job: '', minScore: '' } });
  const { data, loading, error, reload } = useFetch((signal) => applicationsApi.list(list.params, signal).then((r) => r.data), [list.params]);
  const { data: jobs } = useFetch(() => jobsApi.list({ limit: 100 }).then((r) => r.data.items), []);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(null);

  const act = async (key, fn) => {
    setBusy(key);
    try { const res = await fn(); toast.success(res.message); reload(); setDetail(null); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(null); }
  };
  const openCv = async (id) => {
    try { const blob = await applicationsApi.cvBlob(id); window.open(URL.createObjectURL(blob), '_blank', 'noopener'); } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Recrutement" title="Candidatures" description="Score de matching expliqué pour chaque CV. Vous pouvez inviter un profil sous le seuil ou refuser avant l'entretien." />
      <Toolbar search={list.q} onSearch={list.setQ} placeholder="Nom du fichier CV, message…">
        <FilterSelect label="Offre" value={list.filters.job} onChange={list.setFilter('job')} options={[{ value: '', label: 'Toutes les offres' }, ...(jobs || []).map((j) => ({ value: j.id, label: j.title }))]} />
        <FilterSelect label="Statut" value={list.filters.status} onChange={list.setFilter('status')} options={[{ value: '', label: 'Tous les statuts' }, ...Object.entries(APPLICATION_STATUS).map(([value, m]) => ({ value, label: m.label }))]} />
        <FilterSelect label="Score minimal" value={list.filters.minScore} onChange={list.setFilter('minScore')} options={[{ value: '', label: 'Tout score' }, ...[40, 50, 60, 70, 80].map((v) => ({ value: String(v), label: `≥ ${v}` }))]} />
      </Toolbar>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-80" /> : !data.items.length ? <EmptyState title="Aucune candidature" /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-tw-line bg-tw-canvas/60"><tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tw-muted">Candidat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tw-muted">Offre</th>
                <SortHeader field="matching.score" sort={list.sort} onSort={list.setSort}>Matching</SortHeader>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tw-muted">Quiz</th>
                <SortHeader field="status" sort={list.sort} onSort={list.setSort}>Statut</SortHeader>
                <SortHeader field="createdAt" sort={list.sort} onSort={list.setSort}>Déposée</SortHeader>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-tw-muted">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-tw-line">
                {data.items.map((a) => (
                  <tr key={a.id} className="hover:bg-tw-canvas/50">
                    <td className="px-4 py-3"><p className="font-medium">{a.candidate?.firstName} {a.candidate?.lastName}</p><p className="text-xs text-tw-muted">{a.candidate?.email}</p></td>
                    <td className="px-4 py-3 text-tw-muted">{a.job?.title}</td>
                    <td className={`px-4 py-3 font-semibold tabular ${scoreTone(a.matching?.score)}`}>{a.matching?.score}<span className="text-xs font-normal text-tw-muted"> / seuil {a.job?.matchThreshold}</span></td>
                    <td className={`px-4 py-3 tabular ${scoreTone(a.quizAttempt?.percent)}`}>{a.quizAttempt?.percent ?? '—'}</td>
                    <td className="px-4 py-3"><Pill meta={APPLICATION_STATUS} value={a.status} /></td>
                    <td className="px-4 py-3 text-xs text-tw-muted">{fmtDate(a.createdAt)}</td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      <button type="button" title="Analyse du CV" onClick={() => setDetail(a)} className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-tint hover:text-tw-accent"><Eye className="size-4" /></button>
                      <button type="button" title="CV PDF" onClick={() => openCv(a.id)} className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-tint hover:text-tw-accent"><FileText className="size-4" /></button>
                      {a.interview && <Link to={`/recruteur/entretiens/${a.interview.id || a.interview._id}`} title="Entretien" className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-tint hover:text-tw-accent">▶</Link>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.pagination} onPage={list.setPage} onLimit={list.setLimit} />
        </>
      )}
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} size="lg" title={detail ? `${detail.candidate?.firstName} ${detail.candidate?.lastName}` : ''} description={detail?.job?.title}
        footer={detail && (
          <>
            {['soumise', 'refusee'].includes(detail.status) && <Button icon={MailCheck} loading={busy === 'invite'} onClick={() => act('invite', () => applicationsApi.invite(detail.id))}>Inviter en entretien</Button>}
            {!['retenue', 'non_retenue', 'refusee', 'retiree'].includes(detail.status) && <Button variant="danger" icon={XCircle} loading={busy === 'reject'} onClick={() => act('reject', () => applicationsApi.reject(detail.id, ''))}>Refuser</Button>}
            <Button variant="secondary" onClick={() => setDetail(null)}>Fermer</Button>
          </>
        )}>
        {detail && <MatchingCard matching={detail.matching} />}
      </Modal>
    </div>
  );
}
