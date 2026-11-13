import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BarChart3, Copy, List, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import SelectField from '../../components/ui/SelectField';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { FilterSelect, SortHeader, Toolbar } from '../../components/shared';
import { QuizStats } from '../../components/stats/StatsPanels';
import useFetch from '../../hooks/useFetch';
import useListState from '../../hooks/useListState';
import { jobsApi, quizzesApi } from '../../services/api';
import { errorMessage } from '../../services/client';
import { METIERS, QUIZ_STATUS, fmtDay, metierOptions, scoreTone } from '../../utils/labels';

const opts = (all, entries) => [{ value: '', label: all }, ...entries.map(([value, label]) => ({ value, label }))];
const STATUS = opts('Tous les statuts', Object.entries(QUIZ_STATUS).map(([k, v]) => [k, v.label]));
const DIFFICULTY = opts('Toutes difficultés', [['facile', 'Facile'], ['moyen', 'Moyen'], ['difficile', 'Difficile']]);
const SOURCE = opts('Toutes origines', [['banque', 'Banque du métier'], ['ia', 'Générés par IA'], ['manuel', 'Manuels']]);
const LANG = opts('Toutes langues', [['fr', 'Français'], ['en', 'Anglais']]);

function GenerateModal({ open, onClose }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ metier: 'dev-fullstack', job: '', count: 6, difficulty: 'moyen', language: 'fr', mode: 'ia' });
  const [busy, setBusy] = useState(false);
  const { data: jobs } = useFetch(() => (open ? jobsApi.list({ limit: 100, status: 'publiee' }).then((r) => r.data.items) : Promise.resolve([])), [open]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const run = async () => {
    setBusy(true);
    try {
      const body = { ...form, count: Number(form.count) };
      if (body.job) delete body.metier; else delete body.job;
      const res = await quizzesApi.generate(body);
      toast.success(res.message);
      navigate(`/recruteur/quiz/${res.data.quiz.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Générer un quiz" description="Le quiz est créé inactif : relisez-le, puis activez-le."
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Annuler</Button><Button icon={Sparkles} loading={busy} onClick={run}>{busy ? 'Génération (≈ 30-60 s)…' : 'Générer'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Offre ciblée (facultatif)" value={form.job} onChange={set('job')} options={[{ value: '', label: '— Aucune : tout le métier —' }, ...(jobs || []).map((j) => ({ value: j.id, label: j.title }))]} />
        <SelectField label="Métier" value={form.metier} onChange={set('metier')} disabled={Boolean(form.job)} options={Object.entries(METIERS).map(([value, label]) => ({ value, label }))} />
        <SelectField label="Source" value={form.mode} onChange={set('mode')} options={[{ value: 'ia', label: 'LLM local (questions nouvelles)' }, { value: 'banque', label: 'Banque du métier (instantané)' }]} />
        <SelectField label="Nombre de questions" value={form.count} onChange={set('count')} options={[4, 6, 8, 10, 12].map((n) => ({ value: n, label: String(n) }))} />
        <SelectField label="Difficulté" value={form.difficulty} onChange={set('difficulty')} options={DIFFICULTY.slice(1)} />
        <SelectField label="Langue" value={form.language} onChange={set('language')} options={LANG.slice(1)} />
      </div>
    </Modal>
  );
}

export default function Quizzes() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('list');
  const [genOpen, setGenOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = useListState({ sort: '-createdAt', filters: { metier: '', status: '', difficulty: '', source: '', language: '' } });
  const { data, loading, error, reload } = useFetch((signal) => quizzesApi.list(list.params, signal).then((r) => r.data), [list.params]);
  const { data: stats } = useFetch(() => (tab === 'stats' ? quizzesApi.stats({ metier: list.filters.metier }).then((r) => r.data) : Promise.resolve(null)), [tab, list.filters.metier]);

  const act = async (fn, ok) => {
    setBusy(true);
    try { const res = await fn(); toast.success(ok || res.message); reload(); return res; } catch (err) { toast.error(errorMessage(err)); return null; } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Entité 1" title="Quiz de compétences" description="Les quiz testent les compétences du poste avant l'entretien ; leurs résultats orientent les questions de l'avatar."
        actions={<><Button variant="secondary" icon={Sparkles} onClick={() => setGenOpen(true)}>Générer avec l'IA</Button><Button icon={Plus} onClick={() => navigate('/recruteur/quiz/nouveau')}>Nouveau quiz</Button></>} />
      <div className="flex gap-1 rounded-lg border border-tw-line bg-tw-surface p-1 sm:w-fit">
        {[['list', 'Liste', List], ['stats', 'Statistiques', BarChart3]].map(([k, l, I]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm ${tab === k ? 'bg-tw-tint font-medium text-tw-accent' : 'text-tw-muted'}`}><I className="size-4" />{l}</button>
        ))}
      </div>

      <Toolbar search={list.q} onSearch={list.setQ} placeholder="Titre, description, compétence…">
        <FilterSelect label="Métier" value={list.filters.metier} onChange={list.setFilter('metier')} options={metierOptions()} />
        {tab === 'list' && (
          <>
            <FilterSelect label="Statut" value={list.filters.status} onChange={list.setFilter('status')} options={STATUS} />
            <FilterSelect label="Difficulté" value={list.filters.difficulty} onChange={list.setFilter('difficulty')} options={DIFFICULTY} />
            <FilterSelect label="Origine" value={list.filters.source} onChange={list.setFilter('source')} options={SOURCE} />
            <FilterSelect label="Langue" value={list.filters.language} onChange={list.setFilter('language')} options={LANG} />
          </>
        )}
      </Toolbar>

      {tab === 'stats' ? <QuizStats stats={stats} /> : error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-96" /> : !data.items.length ? (
        <EmptyState title="Aucun quiz" description="Créez un quiz ou générez-en un avec l'IA." />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-tw-line bg-tw-canvas/60">
                <tr>
                  <SortHeader field="title" sort={list.sort} onSort={list.setSort}>Quiz</SortHeader>
                  <SortHeader field="metier" sort={list.sort} onSort={list.setSort}>Métier</SortHeader>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tw-muted">Questions</th>
                  <SortHeader field="durationMinutes" sort={list.sort} onSort={list.setSort}>Durée</SortHeader>
                  <SortHeader field="passingScore" sort={list.sort} onSort={list.setSort}>Seuil</SortHeader>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tw-muted">Passages · moy.</th>
                  <SortHeader field="status" sort={list.sort} onSort={list.setSort}>Statut</SortHeader>
                  <SortHeader field="createdAt" sort={list.sort} onSort={list.setSort}>Créé</SortHeader>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-tw-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tw-line">
                {data.items.map((qz) => (
                  <tr key={qz.id} className="hover:bg-tw-canvas/50">
                    <td className="px-4 py-3">
                      <Link to={`/recruteur/quiz/${qz.id}`} className="font-medium hover:text-tw-accent">{qz.title}</Link>
                      <p className="text-xs text-tw-muted">{qz.job?.title || 'Tout le métier'} · {qz.source} · {qz.language} · {qz.difficulty}</p>
                    </td>
                    <td className="px-4 py-3 text-tw-muted">{METIERS[qz.metier]}</td>
                    <td className="px-4 py-3 tabular">{qz.questionsPerAttempt}/{qz.questionCount}</td>
                    <td className="px-4 py-3 tabular">{qz.durationMinutes} min</td>
                    <td className="px-4 py-3 tabular">{qz.passingScore} %</td>
                    <td className="px-4 py-3 tabular">{qz.attempts} · <span className={scoreTone(qz.averageScore)}>{qz.averageScore ?? '—'}</span></td>
                    <td className="px-4 py-3">
                      <select aria-label="Statut" value={qz.status} disabled={busy} onChange={(e) => act(() => quizzesApi.update(qz.id, { status: e.target.value }), 'Statut modifié.')} className="h-8 rounded-md border border-tw-line bg-tw-surface px-1.5 text-xs">
                        {Object.entries(QUIZ_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-tw-muted">{fmtDay(qz.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" title="Modifier" onClick={() => navigate(`/recruteur/quiz/${qz.id}`)} className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-tint hover:text-tw-accent"><Pencil className="size-4" /></button>
                        <button type="button" title="Dupliquer" onClick={() => act(() => quizzesApi.duplicate(qz.id))} className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-tint hover:text-tw-accent"><Copy className="size-4" /></button>
                        <button type="button" title="Supprimer" onClick={() => setToDelete(qz)} className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-danger-soft hover:text-tw-danger"><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.pagination} onPage={list.setPage} onLimit={list.setLimit} />
        </>
      )}
      <GenerateModal open={genOpen} onClose={() => setGenOpen(false)} />
      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} busy={busy} title="Supprimer ce quiz ?" confirmLabel="Supprimer"
        onConfirm={async () => { await act(() => quizzesApi.remove(toDelete.id)); setToDelete(null); }}>
        « {toDelete?.title} » sera supprimé définitivement. Un quiz déjà passé ne peut pas être supprimé : archivez-le.
      </ConfirmDialog>
    </div>
  );
}
