import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import TextField from '../../components/ui/TextField';
import SelectField from '../../components/ui/SelectField';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { FilterSelect, SortHeader, Toolbar } from '../../components/shared';
import useFetch from '../../hooks/useFetch';
import useListState from '../../hooks/useListState';
import { jobsApi } from '../../services/api';
import { errorMessage } from '../../services/client';
import { METIERS, fmtDay, metierOptions } from '../../utils/labels';

const JOB_STATUS = { brouillon: 'Brouillon', publiee: 'Publiée', fermee: 'Fermée' };
const split = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
const EMPTY = { title: '', metier: 'dev-fullstack', description: '', requiredSkills: '', niceToHaveSkills: '', minExperienceYears: 0, languages: 'français', location: 'Tunis', contractType: 'CDI', remote: 'hybride', salaryRange: '', matchThreshold: 60, status: 'publiee' };

function JobForm({ job, onClose, onSaved }) {
  const [form, setForm] = useState(() => (job?.id ? { ...EMPTY, ...job, requiredSkills: job.requiredSkills.join(', '), niceToHaveSkills: job.niceToHaveSkills.join(', '), languages: job.languages.join(', ') } : EMPTY));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    setError(null);
    const body = {
      title: form.title, metier: form.metier, description: form.description, requiredSkills: split(form.requiredSkills), niceToHaveSkills: split(form.niceToHaveSkills),
      minExperienceYears: Number(form.minExperienceYears), languages: split(form.languages), location: form.location, contractType: form.contractType, remote: form.remote,
      salaryRange: form.salaryRange, matchThreshold: Number(form.matchThreshold), status: form.status,
    };
    try {
      const res = job?.id ? await jobsApi.update(job.id, body) : await jobsApi.create(body);
      toast.success(res.message);
      onSaved();
    } catch (err) {
      const list = err?.response?.data?.errors;
      setError(list ? list.map((e) => e.message).join(' ') : errorMessage(err));
    } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} busy={busy} size="lg" title={job?.id ? 'Modifier l\'offre' : 'Nouvelle offre'}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Annuler</Button><Button onClick={save} loading={busy}>Enregistrer</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {error && <Alert tone="error" className="sm:col-span-2">{error}</Alert>}
        <TextField className="sm:col-span-2" label="Titre" value={form.title} onChange={set('title')} />
        <SelectField label="Métier (logique du quiz et de l'entretien)" value={form.metier} onChange={set('metier')} options={Object.entries(METIERS).map(([value, label]) => ({ value, label }))} />
        <SelectField label="Statut" value={form.status} onChange={set('status')} options={Object.entries(JOB_STATUS).map(([value, label]) => ({ value, label }))} />
        <label className="space-y-1.5 sm:col-span-2"><span className="text-sm font-medium">Description (30 caractères min.)</span>
          <textarea value={form.description} onChange={set('description')} rows={5} className="w-full rounded-lg border border-tw-line bg-tw-surface p-3 text-sm focus:border-tw-accent focus:outline-none" />
        </label>
        <TextField label="Compétences exigées (virgules)" value={form.requiredSkills} onChange={set('requiredSkills')} />
        <TextField label="Compétences souhaitées (virgules)" value={form.niceToHaveSkills} onChange={set('niceToHaveSkills')} />
        <TextField label="Expérience minimale (ans)" type="number" min={0} max={30} value={form.minExperienceYears} onChange={set('minExperienceYears')} />
        <TextField label="Seuil d'invitation (score /100)" type="number" min={0} max={100} value={form.matchThreshold} onChange={set('matchThreshold')} hint="Score de matching à partir duquel l'invitation est automatique" />
        <TextField label="Langues (virgules)" value={form.languages} onChange={set('languages')} />
        <TextField label="Lieu" value={form.location} onChange={set('location')} />
        <SelectField label="Contrat" value={form.contractType} onChange={set('contractType')} options={['CDI', 'CDD', 'Stage', 'Freelance', 'Alternance'].map((v) => ({ value: v, label: v }))} />
        <SelectField label="Mode" value={form.remote} onChange={set('remote')} options={['sur site', 'hybride', 'télétravail'].map((v) => ({ value: v, label: v }))} />
        <TextField label="Salaire (facultatif)" value={form.salaryRange} onChange={set('salaryRange')} />
      </div>
    </Modal>
  );
}

export default function JobsManage() {
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = useListState({ filters: { metier: '', status: '', mine: '' } });
  const { data, loading, error, reload } = useFetch((signal) => jobsApi.list(list.params, signal).then((r) => r.data), [list.params]);
  const remove = async () => {
    setBusy(true);
    try { const res = await jobsApi.remove(toDelete.id); toast.success(res.message); setToDelete(null); reload(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Recrutement" title="Offres d'emploi" description="Chaque offre est rattachée à un métier : il fixe le quiz, les questions de l'avatar et la pondération de la note." actions={<Button icon={Plus} onClick={() => setEditing({})}>Nouvelle offre</Button>} />
      <Toolbar search={list.q} onSearch={list.setQ} placeholder="Titre, compétence, lieu…">
        <FilterSelect label="Métier" value={list.filters.metier} onChange={list.setFilter('metier')} options={metierOptions()} />
        <FilterSelect label="Statut" value={list.filters.status} onChange={list.setFilter('status')} options={[{ value: '', label: 'Tous les statuts' }, ...Object.entries(JOB_STATUS).map(([value, label]) => ({ value, label }))]} />
        <FilterSelect label="Mes offres" value={list.filters.mine} onChange={list.setFilter('mine')} options={[{ value: '', label: 'Toutes les offres' }, { value: 'true', label: 'Mes offres' }]} />
      </Toolbar>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-80" /> : !data.items.length ? <EmptyState title="Aucune offre" /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-tw-line bg-tw-canvas/60"><tr>
                <SortHeader field="title" sort={list.sort} onSort={list.setSort}>Offre</SortHeader>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tw-muted">Métier</th>
                <SortHeader field="location" sort={list.sort} onSort={list.setSort}>Lieu</SortHeader>
                <SortHeader field="matchThreshold" sort={list.sort} onSort={list.setSort}>Seuil</SortHeader>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tw-muted">Statut</th>
                <SortHeader field="createdAt" sort={list.sort} onSort={list.setSort}>Créée</SortHeader>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-tw-muted">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-tw-line">
                {data.items.map((j) => (
                  <tr key={j.id} className="hover:bg-tw-canvas/50">
                    <td className="px-4 py-3"><Link to={`/offres/${j.id}`} className="font-medium hover:text-tw-accent">{j.title}</Link><p className="text-xs text-tw-muted">{j.requiredSkills.slice(0, 4).join(', ')}</p></td>
                    <td className="px-4 py-3 text-tw-muted">{METIERS[j.metier]}</td>
                    <td className="px-4 py-3 text-tw-muted">{j.location}</td>
                    <td className="px-4 py-3 tabular">{j.matchThreshold}</td>
                    <td className="px-4 py-3">{JOB_STATUS[j.status]}</td>
                    <td className="px-4 py-3 text-xs text-tw-muted">{fmtDay(j.createdAt)}</td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      <button type="button" title="Modifier" onClick={() => setEditing(j)} className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-tint hover:text-tw-accent"><Pencil className="size-4" /></button>
                      <button type="button" title="Supprimer" onClick={() => setToDelete(j)} className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-danger-soft hover:text-tw-danger"><Trash2 className="size-4" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.pagination} onPage={list.setPage} onLimit={list.setLimit} />
        </>
      )}
      {editing && <JobForm job={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} onConfirm={remove} busy={busy} title="Supprimer cette offre ?" confirmLabel="Supprimer">
        Impossible si des candidatures existent : fermez-la dans ce cas.
      </ConfirmDialog>
    </div>
  );
}
