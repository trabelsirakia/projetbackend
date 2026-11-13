import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BarChart3, CalendarPlus, Eye, List, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import SelectField from '../../components/ui/SelectField';
import TextField from '../../components/ui/TextField';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { FilterSelect, Pill, SortHeader, Toolbar } from '../../components/shared';
import { InterviewStats } from '../../components/stats/StatsPanels';
import useFetch from '../../hooks/useFetch';
import useListState from '../../hooks/useListState';
import { applicationsApi, interviewsApi } from '../../services/api';
import { errorMessage } from '../../services/client';
import { DECISION, INTERVIEW_STATUS, RECOMMENDATION, fmtDate, metierOptions, scoreTone } from '../../utils/labels';

const opts = (all, meta) => [{ value: '', label: all }, ...Object.entries(meta).map(([value, m]) => ({ value, label: m.label }))];
const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

function EditModal({ itv, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ scheduledAt: toLocal(itv?.scheduledAt), expiresAt: toLocal(itv?.expiresAt), language: itv?.language || 'fr', recruiterNotes: itv?.recruiterNotes || '' }));
  const [busy, setBusy] = useState(false);
  const planned = itv?.status === 'planifie';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (extra = {}) => {
    setBusy(true);
    try {
      const body = planned ? { ...form, scheduledAt: new Date(form.scheduledAt).toISOString(), expiresAt: new Date(form.expiresAt).toISOString(), ...extra } : { recruiterNotes: form.recruiterNotes };
      const res = await interviewsApi.update(itv.id, body);
      toast.success(res.message);
      onSaved();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Modal open={Boolean(itv)} onClose={onClose} busy={busy} title="Modifier l'entretien" description={itv ? `${itv.candidateName} — ${itv.title}` : ''}
      footer={<>{planned && <Button variant="danger" onClick={() => save({ status: 'annule' })} disabled={busy}>Annuler l'entretien</Button>}<Button variant="secondary" onClick={onClose} disabled={busy}>Fermer</Button><Button onClick={() => save()} loading={busy}>Enregistrer</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Créneau" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} disabled={!planned} />
        <TextField label="Date limite" type="datetime-local" value={form.expiresAt} onChange={set('expiresAt')} disabled={!planned} />
        <SelectField label="Langue de l'avatar" value={form.language} onChange={set('language')} disabled={!planned} options={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'Anglais' }]} />
        <label className="space-y-1.5 sm:col-span-2"><span className="text-sm font-medium">Notes du recruteur</span>
          <textarea value={form.recruiterNotes} onChange={set('recruiterNotes')} rows={3} className="w-full rounded-lg border border-tw-line bg-tw-surface p-3 text-sm" />
        </label>
      </div>
    </Modal>
  );
}

function PlanModal({ open, onClose, onSaved }) {
  const [application, setApplication] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: apps } = useFetch(() => (open ? applicationsApi.list({ limit: 100, sort: '-createdAt' }).then((r) => r.data.items.filter((a) => !a.interview)) : Promise.resolve([])), [open]);
  const save = async () => {
    setBusy(true);
    try {
      const res = await interviewsApi.create({ application, ...(scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}) });
      toast.success(res.message);
      onSaved();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Planifier un entretien" description="Pour une candidature sans entretien (ex. score sous le seuil mais profil intéressant). Le candidat reçoit l'e-mail d'invitation."
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Annuler</Button><Button onClick={save} loading={busy} disabled={!application}>Planifier</Button></>}>
      <div className="space-y-4">
        <SelectField label="Candidature" value={application} onChange={(e) => setApplication(e.target.value)} options={[{ value: '', label: (apps || []).length ? 'Choisir…' : 'Aucune candidature sans entretien' }, ...(apps || []).map((a) => ({ value: a.id, label: `${a.candidate?.firstName} ${a.candidate?.lastName} — ${a.job?.title} (${a.matching?.score}/100)` }))]} />
        <TextField label="Créneau (facultatif)" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} hint="Par défaut : prochain jour ouvré à 10 h." />
      </div>
    </Modal>
  );
}

export default function Interviews() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('list');
  const [editing, setEditing] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = useListState({ sort: '-scheduledAt', filters: { status: '', metier: '', recommendation: '', decision: '', language: '', minScore: '' } });
  const { data, loading, error, reload } = useFetch((signal) => interviewsApi.list(list.params, signal).then((r) => r.data), [list.params]);
  const { data: stats } = useFetch(() => (tab === 'stats' ? interviewsApi.stats({ metier: list.filters.metier }).then((r) => r.data) : Promise.resolve(null)), [tab, list.filters.metier]);

  const remove = async () => {
    setBusy(true);
    try { const res = await interviewsApi.remove(toDelete.id); toast.success(res.message); setToDelete(null); reload(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Entité 2" title="Entretiens vidéo" description="Entretiens de 5 minutes menés par l'avatar : transcriptions, notes par question, recommandation de l'IA et votre décision."
        actions={<Button icon={CalendarPlus} onClick={() => setPlanning(true)}>Planifier</Button>} />
      <div className="flex gap-1 rounded-lg border border-tw-line bg-tw-surface p-1 sm:w-fit">
        {[['list', 'Liste', List], ['stats', 'Statistiques', BarChart3]].map(([k, l, I]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm ${tab === k ? 'bg-tw-tint font-medium text-tw-accent' : 'text-tw-muted'}`}><I className="size-4" />{l}</button>
        ))}
      </div>
      <Toolbar search={list.q} onSearch={list.setQ} placeholder="Candidat, poste, synthèse…">
        <FilterSelect label="Métier" value={list.filters.metier} onChange={list.setFilter('metier')} options={metierOptions()} />
        {tab === 'list' && (
          <>
            <FilterSelect label="Statut" value={list.filters.status} onChange={list.setFilter('status')} options={opts('Tous les statuts', INTERVIEW_STATUS)} />
            <FilterSelect label="Avis IA" value={list.filters.recommendation} onChange={list.setFilter('recommendation')} options={opts('Tous les avis', RECOMMENDATION)} />
            <FilterSelect label="Décision" value={list.filters.decision} onChange={list.setFilter('decision')} options={opts('Toutes décisions', DECISION)} />
            <FilterSelect label="Note minimale" value={list.filters.minScore} onChange={list.setFilter('minScore')} options={[{ value: '', label: 'Toute note' }, ...[50, 60, 70, 80].map((v) => ({ value: String(v), label: `≥ ${v}` }))]} />
          </>
        )}
      </Toolbar>

      {tab === 'stats' ? <InterviewStats stats={stats} /> : error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-96" /> : !data.items.length ? (
        <EmptyState title="Aucun entretien" description="Les entretiens sont créés automatiquement quand un candidat atteint le seuil de matching." />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-tw-line bg-tw-canvas/60">
                <tr>
                  <SortHeader field="candidateName" sort={list.sort} onSort={list.setSort}>Candidat</SortHeader>
                  <SortHeader field="title" sort={list.sort} onSort={list.setSort}>Poste</SortHeader>
                  <SortHeader field="scheduledAt" sort={list.sort} onSort={list.setSort}>Créneau</SortHeader>
                  <SortHeader field="status" sort={list.sort} onSort={list.setSort}>Statut</SortHeader>
                  <SortHeader field="evaluation.overall" sort={list.sort} onSort={list.setSort}>Note</SortHeader>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tw-muted">Avis IA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tw-muted">Décision</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-tw-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tw-line">
                {data.items.map((it) => (
                  <tr key={it.id} className="hover:bg-tw-canvas/50">
                    <td className="px-4 py-3 font-medium"><Link to={`/recruteur/entretiens/${it.id}`} className="hover:text-tw-accent">{it.candidateName}</Link><p className="text-xs font-normal text-tw-muted">{it.language === 'en' ? 'Anglais' : 'Français'} · {it.meet?.provider === 'google' ? 'Meet' : 'Jitsi'}</p></td>
                    <td className="px-4 py-3 text-tw-muted">{it.job?.title || it.title}</td>
                    <td className="px-4 py-3 text-xs">{fmtDate(it.scheduledAt)}</td>
                    <td className="px-4 py-3"><Pill meta={INTERVIEW_STATUS} value={it.status} /></td>
                    <td className={`px-4 py-3 font-semibold tabular ${scoreTone(it.evaluation?.overall)}`}>{it.evaluation?.overall ?? '—'}</td>
                    <td className="px-4 py-3">{it.evaluation?.recommendation ? <Pill meta={RECOMMENDATION} value={it.evaluation.recommendation} /> : '—'}</td>
                    <td className="px-4 py-3"><Pill meta={DECISION} value={it.decision?.value || 'en_attente'} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" title="Voir" onClick={() => navigate(`/recruteur/entretiens/${it.id}`)} className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-tint hover:text-tw-accent"><Eye className="size-4" /></button>
                        <button type="button" title="Modifier" onClick={() => setEditing(it)} className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-tint hover:text-tw-accent"><Pencil className="size-4" /></button>
                        <button type="button" title="Supprimer" onClick={() => setToDelete(it)} className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-danger-soft hover:text-tw-danger"><Trash2 className="size-4" /></button>
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
      {editing && <EditModal itv={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      <PlanModal open={planning} onClose={() => setPlanning(false)} onSaved={() => { setPlanning(false); reload(); }} />
      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} onConfirm={remove} busy={busy} title="Supprimer cet entretien ?" confirmLabel="Supprimer">
        L'entretien de {toDelete?.candidateName} (transcriptions et notes) sera supprimé définitivement ; la réunion Google Meet éventuelle est annulée.
      </ConfirmDialog>
    </div>
  );
}
