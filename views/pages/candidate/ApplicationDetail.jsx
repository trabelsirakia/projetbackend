import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ArrowLeft, Check, ExternalLink, Video } from 'lucide-react';
import Button from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Modal';
import { ErrorState, Skeleton } from '../../components/ui/Feedback';
import { MatchingCard, Pill, ScoreBar, ScoreRing } from '../../components/shared';
import useFetch from '../../hooks/useFetch';
import { applicationsApi, interviewsApi } from '../../services/api';
import { errorMessage } from '../../services/client';
import { APPLICATION_STATUS, DECISION, INTERVIEW_STATUS, fmtDate, scoreTone } from '../../utils/labels';
import { NextAction } from './MyApplications';

const STEPS = ['Analyse du CV', 'Quiz', 'Entretien', 'Évaluation', 'Décision'];

function Stepper({ status }) {
  const current = APPLICATION_STATUS[status]?.step ?? 0;
  const failed = ['refusee', 'non_retenue', 'retiree'].includes(status);
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Étapes de la candidature">
      {STEPS.map((s, i) => {
        const done = i < current || (i === current && ['retenue', 'non_retenue'].includes(status));
        const active = i === current && !done;
        return (
          <li key={s} className="flex flex-col items-center gap-2 text-center">
            <span className={clsx('grid size-9 place-items-center rounded-full text-sm font-semibold ring-1',
              done ? 'bg-tw-primary text-white ring-tw-primary' : active ? (failed ? 'bg-tw-danger-soft text-tw-danger ring-tw-danger-line' : 'bg-tw-tint text-tw-accent ring-tw-accent/40') : 'bg-tw-surface text-tw-muted ring-tw-line')}>
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={clsx('text-[11px] leading-tight sm:text-xs', active ? 'font-semibold' : 'text-tw-muted')}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: app, loading, error, reload } = useFetch(() => applicationsApi.get(id).then((r) => r.data), [id]);
  const itvId = app?.interview?.id || app?.interview?._id;
  const { data: itv } = useFetch(() => (itvId ? interviewsApi.get(itvId).then((r) => r.data) : Promise.resolve(null)), [itvId]);

  const withdraw = async () => {
    setBusy(true);
    try {
      await applicationsApi.withdraw(id);
      toast.success('Candidature retirée.');
      setConfirm(false);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="mx-auto max-w-5xl px-4 py-10"><ErrorState message={error} onRetry={reload} /></div>;
  if (loading || !app) return <div className="mx-auto max-w-5xl space-y-4 px-4 py-10"><Skeleton className="h-24" /><Skeleton className="h-80" /></div>;
  const ev = itv?.status === 'evalue' ? itv.evaluation : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <Link to="/mes-candidatures" className="inline-flex items-center gap-1 text-sm text-tw-muted hover:text-tw-ink"><ArrowLeft className="size-4" />Mes candidatures</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Candidature</p>
          <h1 className="mt-1.5 text-2xl font-semibold">{app.job.title}</h1>
          <div className="mt-2 flex items-center gap-2"><Pill meta={APPLICATION_STATUS} value={app.status} /><span className="text-xs text-tw-muted">déposée le {fmtDate(app.createdAt)}</span></div>
        </div>
        <div className="flex gap-2">
          <NextAction app={{ ...app, interview: app.interview }} />
          {!['retenue', 'non_retenue', 'retiree', 'refusee'].includes(app.status) && <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>Retirer</Button>}
        </div>
      </div>
      <div className="card p-5"><Stepper status={app.status} /></div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MatchingCard matching={app.matching} title="Analyse de votre CV" />
        <div className="space-y-6">
          {app.quizAttempt && (
            <div className="card p-5">
              <p className="eyebrow">Quiz de compétences</p>
              <p className="mt-2 text-sm text-tw-muted">{app.quiz?.title}</p>
              <p className={clsx('mt-1 text-3xl font-bold tabular', scoreTone(app.quizAttempt.percent))}>{app.quizAttempt.percent}<span className="text-base text-tw-muted">/100</span></p>
              <div className="mt-3 divide-y divide-tw-line">
                {app.quizAttempt.perSkill?.map((s) => <ScoreBar key={s.skill} label={`${s.skill} (${s.correct}/${s.total})`} value={s.percent} />)}
              </div>
            </div>
          )}
          {itv && (
            <div className="card p-5">
              <div className="flex items-center justify-between"><p className="eyebrow">Entretien vidéo</p><Pill meta={INTERVIEW_STATUS} value={itv.status} /></div>
              <p className="mt-2 text-sm text-tw-muted">Créneau proposé : {fmtDate(itv.scheduledAt)} · accessible jusqu'au {fmtDate(itv.expiresAt)}</p>
              {itv.meet?.link && (
                <a href={itv.meet.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-tw-accent hover:underline">
                  <Video className="size-4" />Rejoindre la visio {itv.meet.provider === 'google' ? 'Google Meet' : 'Jitsi Meet'}<ExternalLink className="size-3.5" />
                </a>
              )}
              {ev && (
                <div className="mt-4 flex items-center gap-5">
                  <ScoreRing value={ev.overall} size={104} label="/100" />
                  <div className="flex-1 text-sm">
                    <ScoreBar label="Technique" value={ev.technical} />
                    <ScoreBar label="Communication" value={ev.communication} />
                    <ScoreBar label="Motivation" value={ev.motivation} />
                  </div>
                </div>
              )}
              {itv.decision?.value && itv.decision.value !== 'en_attente' && (
                <div className="mt-4 rounded-lg bg-tw-canvas p-3 text-sm"><Pill meta={DECISION} value={itv.decision.value} />{itv.decision.comment && <p className="mt-2">« {itv.decision.comment} »</p>}</div>
              )}
              {itv.status === 'evalue' && <Link to={`/entretien/${itv.id}`} className="mt-4 inline-block text-sm font-medium text-tw-accent hover:underline">Voir le détail question par question →</Link>}
            </div>
          )}
        </div>
      </div>

      <div className="card p-5">
        <p className="eyebrow">Historique</p>
        <ol className="mt-4 space-y-3 border-l border-tw-line pl-5">
          {[...app.timeline].reverse().map((t, i) => (
            <li key={`${t.at}-${i}`} className="relative text-sm">
              <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-tw-primary ring-4 ring-tw-surface" />
              <p className="font-medium">{APPLICATION_STATUS[t.status]?.label || t.status}</p>
              <p className="text-xs text-tw-muted">{fmtDate(t.at)}{t.note ? ` — ${t.note}` : ''}</p>
            </li>
          ))}
        </ol>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={withdraw} busy={busy} title="Retirer cette candidature ?" confirmLabel="Retirer">
        Le quiz et l'entretien prévus seront annulés. Cette action est définitive.
      </ConfirmDialog>
    </div>
  );
}
