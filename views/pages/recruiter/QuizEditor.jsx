import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import SelectField from '../../components/ui/SelectField';
import { Alert, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { DataTable } from '../../components/charts/ChartKit';
import useFetch from '../../hooks/useFetch';
import { jobsApi, quizzesApi } from '../../services/api';
import { errorMessage } from '../../services/client';
import { METIERS, fmtDate } from '../../utils/labels';

const EMPTY_Q = () => ({ text: '', options: ['', '', '', ''], correctIndex: 0, explanation: '', skill: '', points: 1, difficulty: 'moyen' });
const DEFAULT = { title: '', description: '', metier: 'dev-fullstack', job: '', language: 'fr', difficulty: 'moyen', durationMinutes: 10, passingScore: 60, questionsPerAttempt: 10, shuffleQuestions: true, maxAttempts: 1, status: 'inactif', questions: [EMPTY_Q()] };
const LETTERS = 'ABCDEF';

function validate(f) {
  const errs = [];
  if (f.title.trim().length < 3) errs.push('Titre : 3 caractères minimum.');
  if (!f.questions.length) errs.push('Ajoutez au moins une question.');
  f.questions.forEach((q, i) => {
    if (q.text.trim().length < 5) errs.push(`Question ${i + 1} : énoncé trop court.`);
    if (!q.skill.trim()) errs.push(`Question ${i + 1} : compétence manquante.`);
    if (q.options.filter((o) => o.trim()).length !== q.options.length) errs.push(`Question ${i + 1} : réponse vide.`);
    if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) errs.push(`Question ${i + 1} : réponses en double.`);
  });
  return errs;
}

export default function QuizEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [form, setForm] = useState(DEFAULT);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const { data, loading, error, reload } = useFetch(() => (isNew ? Promise.resolve(null) : quizzesApi.get(id).then((r) => r.data)), [id]);
  const { data: jobs } = useFetch(() => jobsApi.list({ limit: 100 }).then((r) => r.data.items), []);
  const { data: attempts } = useFetch(() => (isNew ? Promise.resolve(null) : quizzesApi.attempts(id, { limit: 20, sort: '-createdAt' }).then((r) => r.data)), [id]);

  useEffect(() => {
    if (data) setForm({ ...DEFAULT, ...data, job: data.job?.id || data.job?._id || '', questions: data.questions.map(({ _id, ...q }) => ({ ...q, _id })) });
  }, [data]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setQ = (i, patch) => setForm((f) => ({ ...f, questions: f.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));
  const move = (i, d) => setForm((f) => { const qs = [...f.questions]; [qs[i], qs[i + d]] = [qs[i + d], qs[i]]; return { ...f, questions: qs }; });

  const save = async () => {
    const errs = validate(form);
    setErrors(errs);
    if (errs.length) return;
    setSaving(true);
    const body = {
      ...form,
      job: form.job || null,
      durationMinutes: Number(form.durationMinutes),
      passingScore: Number(form.passingScore),
      questionsPerAttempt: Math.min(Number(form.questionsPerAttempt), form.questions.length),
      maxAttempts: Number(form.maxAttempts),
      questions: form.questions.map((q) => ({ ...q, points: Number(q.points), correctIndex: Number(q.correctIndex) })),
    };
    ['id', '_id', 'createdAt', 'updatedAt', 'createdBy', 'source', 'questionCount', 'skills'].forEach((k) => delete body[k]);
    try {
      const res = isNew ? await quizzesApi.create(body) : await quizzesApi.update(id, body);
      toast.success(res.message);
      if (isNew) navigate(`/recruteur/quiz/${res.data.id}`, { replace: true }); else reload();
    } catch (err) {
      const list = err?.response?.data?.errors;
      setErrors(list ? list.map((e) => `${e.field} : ${e.message}`) : [errorMessage(err)]);
    } finally {
      setSaving(false);
    }
  };

  if (error) return <div className="mx-auto max-w-5xl px-4 py-10"><ErrorState message={error} onRetry={reload} /></div>;
  if (!isNew && (loading || !data)) return <div className="mx-auto max-w-5xl space-y-4 px-4 py-10"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <Link to="/recruteur/quiz" className="inline-flex items-center gap-1 text-sm text-tw-muted hover:text-tw-ink"><ArrowLeft className="size-4" />Tous les quiz</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">{isNew ? 'Création' : `Modification · ${data.source}`}</p><h1 className="mt-1 text-2xl font-semibold">{isNew ? 'Nouveau quiz' : form.title}</h1></div>
        <Button icon={Save} loading={saving} onClick={save}>Enregistrer</Button>
      </div>
      {errors.length > 0 && <Alert tone="error" title="À corriger">{errors.slice(0, 6).map((e) => <p key={e}>{e}</p>)}</Alert>}

      <section className="card grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <TextField className="sm:col-span-2" label="Titre" value={form.title} onChange={set('title')} />
        <SelectField label="Métier" value={form.metier} onChange={set('metier')} options={Object.entries(METIERS).map(([value, label]) => ({ value, label }))} />
        <SelectField label="Offre (facultatif)" value={form.job} onChange={set('job')} options={[{ value: '', label: 'Tout le métier' }, ...(jobs || []).map((j) => ({ value: j.id, label: j.title }))]} />
        <label className="space-y-1.5 sm:col-span-2 lg:col-span-4"><span className="text-sm font-medium">Description</span>
          <textarea value={form.description} onChange={set('description')} rows={2} className="w-full rounded-lg border border-tw-line bg-tw-surface p-3 text-sm focus:border-tw-accent focus:outline-none" />
        </label>
        <TextField label="Durée (minutes)" type="number" min={2} max={60} value={form.durationMinutes} onChange={set('durationMinutes')} />
        <TextField label="Seuil de réussite (%)" type="number" min={0} max={100} value={form.passingScore} onChange={set('passingScore')} />
        <TextField label="Questions tirées par passage" type="number" min={1} value={form.questionsPerAttempt} onChange={set('questionsPerAttempt')} hint={`sur ${form.questions.length}`} />
        <TextField label="Tentatives" type="number" min={1} max={5} value={form.maxAttempts} onChange={set('maxAttempts')} />
        <SelectField label="Difficulté" value={form.difficulty} onChange={set('difficulty')} options={[['facile', 'Facile'], ['moyen', 'Moyen'], ['difficile', 'Difficile']].map(([value, label]) => ({ value, label }))} />
        <SelectField label="Langue" value={form.language} onChange={set('language')} options={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'Anglais' }]} />
        <SelectField label="Statut" value={form.status} onChange={set('status')} options={[{ value: 'actif', label: 'Actif' }, { value: 'inactif', label: 'Inactif' }, { value: 'archive', label: 'Archivé' }]} />
        <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" checked={form.shuffleQuestions} onChange={set('shuffleQuestions')} className="size-4 accent-[var(--color-tw-primary)]" />Ordre aléatoire</label>
      </section>

      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Questions ({form.questions.length})</h2><Button variant="secondary" icon={Plus} onClick={() => setForm((f) => ({ ...f, questions: [...f.questions, EMPTY_Q()] }))}>Ajouter</Button></div>
      {form.questions.map((q, i) => (
        <section key={q._id || i} className="card space-y-3 p-5">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-tw-tint text-xs font-semibold text-tw-accent">{i + 1}</span>
            <input value={q.skill} onChange={(e) => setQ(i, { skill: e.target.value })} placeholder="Compétence (ex. React)" className="h-9 w-44 rounded-md border border-tw-line bg-tw-surface px-2 text-sm" aria-label="Compétence" />
            <select value={q.difficulty} onChange={(e) => setQ(i, { difficulty: e.target.value })} className="h-9 rounded-md border border-tw-line bg-tw-surface px-2 text-sm" aria-label="Difficulté"><option value="facile">Facile</option><option value="moyen">Moyen</option><option value="difficile">Difficile</option></select>
            <input type="number" min={1} max={10} value={q.points} onChange={(e) => setQ(i, { points: e.target.value })} className="h-9 w-16 rounded-md border border-tw-line bg-tw-surface px-2 text-sm" aria-label="Points" title="Points" />
            <div className="ml-auto flex gap-1">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-canvas disabled:opacity-30" aria-label="Monter"><ArrowUp className="size-4" /></button>
              <button type="button" disabled={i === form.questions.length - 1} onClick={() => move(i, 1)} className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-canvas disabled:opacity-30" aria-label="Descendre"><ArrowDown className="size-4" /></button>
              <button type="button" onClick={() => setForm((f) => ({ ...f, questions: f.questions.filter((_, j) => j !== i) }))} className="grid size-8 place-items-center rounded-md text-tw-muted hover:bg-tw-danger-soft hover:text-tw-danger" aria-label="Supprimer la question"><Trash2 className="size-4" /></button>
            </div>
          </div>
          <textarea value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} rows={2} placeholder="Énoncé de la question" className="w-full rounded-lg border border-tw-line bg-tw-surface p-3 text-sm focus:border-tw-accent focus:outline-none" aria-label="Énoncé" />
          <div className="grid gap-2 sm:grid-cols-2">
            {q.options.map((o, j) => (
              <div key={j} className={clsx('flex items-center gap-2 rounded-lg border p-1.5 pl-2', Number(q.correctIndex) === j ? 'border-tw-success bg-tw-success-soft' : 'border-tw-line')}>
                <input type="radio" name={`correct-${i}`} checked={Number(q.correctIndex) === j} onChange={() => setQ(i, { correctIndex: j })} aria-label={`Réponse ${LETTERS[j]} correcte`} className="accent-[var(--color-tw-success)]" />
                <span className="text-xs font-semibold text-tw-muted">{LETTERS[j]}</span>
                <input value={o} onChange={(e) => setQ(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} className="h-8 flex-1 bg-transparent text-sm focus:outline-none" placeholder={`Réponse ${LETTERS[j]}`} />
                {q.options.length > 2 && <button type="button" onClick={() => setQ(i, { options: q.options.filter((_, k) => k !== j), correctIndex: (() => { const c = Number(q.correctIndex); return c === j ? 0 : c > j ? c - 1 : c; })() })} className="text-tw-muted hover:text-tw-danger" aria-label="Retirer la réponse"><X className="size-3.5" /></button>}
              </div>
            ))}
          </div>
          {q.options.length < 6 && <button type="button" onClick={() => setQ(i, { options: [...q.options, ''] })} className="text-sm text-tw-accent hover:underline">+ réponse</button>}
          <input value={q.explanation} onChange={(e) => setQ(i, { explanation: e.target.value })} placeholder="Explication affichée dans la correction (facultatif)" className="h-9 w-full rounded-md border border-tw-line bg-tw-surface px-3 text-sm" aria-label="Explication" />
        </section>
      ))}

      {attempts?.items?.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold">Derniers passages</h2>
          <div className="mt-3 overflow-x-auto">
            <DataTable columns={[
              { key: 'candidate', label: 'Candidat', format: (c) => (c ? `${c.firstName} ${c.lastName}` : '—') },
              { key: 'percent', label: 'Score', align: 'right', format: (v) => `${v}/100` },
              { key: 'passed', label: 'Réussi', format: (v) => (v ? 'oui' : 'non') },
              { key: 'status', label: 'Statut' },
              { key: 'submittedAt', label: 'Envoyé', format: (v) => fmtDate(v) },
            ]} rows={attempts.items} />
          </div>
        </section>
      )}
      <div className="flex justify-end"><Button icon={Save} loading={saving} onClick={save}>Enregistrer</Button></div>
    </div>
  );
}
