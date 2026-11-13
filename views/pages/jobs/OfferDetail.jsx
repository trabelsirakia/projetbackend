import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import toast from 'react-hot-toast';
import {
  ArrowLeft, CheckCircle2, FileText, Languages, MapPin, Send, Sparkles, Upload, XCircle,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Alert, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { MatchingCard, Pill } from '../../components/shared';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import { applicationsApi, jobsApi } from '../../services/api';
import { errorMessage } from '../../services/client';
import { APPLICATION_STATUS, METIERS } from '../../utils/labels';

const STAGES = ['Lecture du CV (PDF)…', 'Repérage des compétences…', 'Comparaison sémantique avec le poste…', 'Calcul du score expliqué…'];

function ApplyModal({ job, open, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [letter, setLetter] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const input = useRef(null);
  const navigate = useNavigate();

  const pick = (f) => {
    setError(null);
    if (!f) return;
    if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) return setError('Seul le format PDF est accepté.');
    if (f.size > 5 * 1048576) return setError('CV trop volumineux : 5 Mo maximum.');
    return setFile(f);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setStage(0);
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1200);
    try {
      const res = await applicationsApi.apply({ jobId: job.id, coverLetter: letter, file });
      setResult(res);
      onDone?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  };

  const close = () => { if (!busy) { onClose(); setTimeout(() => { setResult(null); setFile(null); setLetter(''); }, 200); } };
  const app = result?.data;
  const invited = app?.status === 'invitee';

  return (
    <Modal open={open} onClose={close} title={result ? 'Résultat de l\'analyse' : `Postuler — ${job.title}`} size="lg" busy={busy}
      footer={result ? (
        <>
          <Button variant="secondary" onClick={close}>Fermer</Button>
          {invited ? <Button onClick={() => navigate(`/quiz/${app.id}`)}>Passer le quiz maintenant</Button> : <Button onClick={() => navigate('/offres')}>Voir d'autres offres</Button>}
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>Annuler</Button>
          <Button icon={Send} onClick={submit} loading={busy} disabled={!file}>Envoyer ma candidature</Button>
        </>
      )}
    >
      <AnimatePresence mode="wait">
        {result ? (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Alert tone={invited ? 'success' : 'warning'} title={invited ? 'Vous êtes invité·e en entretien !' : 'Seuil non atteint pour ce poste'}>
              {result.message}
            </Alert>
            <MatchingCard matching={app.matching} title={job.title} />
            {invited && (
              <div className="rounded-lg border border-tw-line bg-tw-canvas p-4 text-sm">
                <p className="font-semibold">Prochaines étapes</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-tw-muted">
                  <li>Quiz de compétences chronométré (une tentative).</li>
                  <li>Entretien vidéo de 5 minutes avec l'avatar, jusqu'au {new Date(app.interview?.expiresAt).toLocaleDateString('fr-FR')}.</li>
                  <li>Lien de visioconférence ({app.interview?.meet?.provider === 'google' ? 'Google Meet' : 'Jitsi Meet'}) envoyé par e-mail.</li>
                </ol>
              </div>
            )}
          </motion.div>
        ) : busy ? (
          <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-5 py-10 text-center">
            <span className="relative grid size-16 place-items-center rounded-full bg-tw-tint text-tw-accent">
              <Sparkles className="size-7" />
              <span className="absolute inset-0 animate-ping rounded-full bg-tw-accent/15" />
            </span>
            <div>
              <p className="font-semibold">L'IA analyse votre CV</p>
              <p className="mt-1 text-sm text-tw-muted">{STAGES[stage]}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            <button
              type="button" onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-tw-line bg-tw-canvas px-6 py-10 text-center transition-colors hover:border-tw-accent/50"
            >
              {file ? <FileText className="size-8 text-tw-accent" /> : <Upload className="size-8 text-tw-muted" />}
              <span className="font-medium">{file ? file.name : 'Déposez votre CV (PDF) ou cliquez pour le choisir'}</span>
              <span className="text-xs text-tw-muted">{file ? `${(file.size / 1024).toFixed(0)} Ko` : 'PDF texte, 5 Mo maximum, 10 pages maximum'}</span>
            </button>
            <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files[0])} />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Message au recruteur (facultatif)</span>
              <textarea value={letter} onChange={(e) => setLetter(e.target.value)} maxLength={3000} rows={4} className="w-full rounded-lg border border-tw-line bg-tw-surface p-3 text-sm focus:border-tw-accent focus:outline-none focus:ring-3 focus:ring-tw-accent/15" placeholder="Quelques lignes sur votre motivation…" />
            </label>
            <p className="text-xs text-tw-muted">Score minimal pour une invitation en entretien sur cette offre : <strong>{job.matchThreshold}/100</strong>.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

export default function OfferDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: job, loading, error, reload } = useFetch(() => jobsApi.get(id).then((r) => r.data), [id, user?.id]);

  const onApply = () => {
    if (!user) {
      toast('Connectez-vous ou créez votre espace pour postuler.');
      navigate('/login', { state: { from: `/offres/${id}` } });
      return;
    }
    setOpen(true);
  };

  if (error) return <div className="mx-auto max-w-5xl px-4 py-10"><ErrorState message={error} onRetry={reload} /></div>;
  if (loading || !job) return <div className="mx-auto max-w-5xl space-y-4 px-4 py-10"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64" /></div>;

  const mine = job.myApplication;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link to="/offres" className="inline-flex items-center gap-1 text-sm text-tw-muted hover:text-tw-ink"><ArrowLeft className="size-4" />Toutes les offres</Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
        <article>
          <p className="eyebrow">{METIERS[job.metier]}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em]">{job.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-tw-muted">
            <span className="inline-flex items-center gap-1"><MapPin className="size-4" />{job.location} · {job.remote}</span>
            <span>{job.contractType}</span>
            {job.salaryRange && <span>{job.salaryRange}</span>}
            <span className="inline-flex items-center gap-1"><Languages className="size-4" />{job.languages.join(', ')}</span>
          </div>
          <div className="prose mt-8 max-w-none whitespace-pre-line text-[15px] leading-relaxed">{job.description}</div>
          <h2 className="mt-8 text-lg font-semibold">Compétences demandées</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {job.requiredSkills.map((s) => <span key={s} className="rounded-md bg-tw-tint px-2.5 py-1 text-sm text-tw-accent">{s}</span>)}
            {job.niceToHaveSkills.map((s) => <span key={s} className="rounded-md bg-tw-canvas px-2.5 py-1 text-sm text-tw-muted ring-1 ring-tw-line">{s} (souhaité)</span>)}
          </div>
          {job.minExperienceYears > 0 && <p className="mt-4 text-sm text-tw-muted">Expérience attendue : {job.minExperienceYears} an(s) minimum.</p>}
        </article>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            {mine ? (
              <>
                <p className="text-sm text-tw-muted">Votre candidature</p>
                <div className="mt-2 flex items-center gap-2"><Pill meta={APPLICATION_STATUS} value={mine.status} />{mine.score != null && <span className="text-sm font-semibold">{mine.score}/100</span>}</div>
                <Button className="mt-4 w-full" onClick={() => navigate(`/mes-candidatures/${mine.id}`)}>Suivre ma candidature</Button>
              </>
            ) : user && user.role !== 'candidat' ? (
              <p className="text-sm text-tw-muted">Connecté·e en tant que recruteur : la candidature est réservée aux candidats.</p>
            ) : (
              <>
                <p className="font-semibold">Intéressé·e ?</p>
                <p className="mt-1 text-sm text-tw-muted">Déposez votre CV : vous saurez en quelques secondes si vous êtes invité·e en entretien.</p>
                <Button size="lg" className="mt-4 w-full" icon={Send} onClick={onApply}>Postuler</Button>
              </>
            )}
          </div>
          <div className="card space-y-2.5 p-5 text-sm">
            <p className="font-semibold">Le parcours</p>
            {['Analyse IA du CV', 'Quiz de compétences', 'Entretien avatar (5 min)', 'Décision du recruteur'].map((s) => (
              <p key={s} className="flex items-center gap-2 text-tw-muted"><CheckCircle2 className="size-4 text-tw-accent" />{s}</p>
            ))}
            <p className="flex items-center gap-2 text-tw-muted"><XCircle className="size-4" />Aucun frais, aucune donnée revendue</p>
          </div>
        </aside>
      </div>
      <ApplyModal job={job} open={open} onClose={() => setOpen(false)} onDone={reload} />
    </div>
  );
}
