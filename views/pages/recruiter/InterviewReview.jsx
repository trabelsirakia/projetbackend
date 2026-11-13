import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ArrowLeft, CheckCircle2, ExternalLink, FileText, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, Video, XCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import { ErrorState, Skeleton } from '../../components/ui/Feedback';
import { MatchingCard, Pill, ScoreBar, ScoreRing } from '../../components/shared';
import useFetch from '../../hooks/useFetch';
import { applicationsApi, interviewsApi } from '../../services/api';
import { errorMessage } from '../../services/client';
import { DECISION, INTERVIEW_STATUS, QUESTION_TYPES, RECOMMENDATION, fmtDate, scoreTone } from '../../utils/labels';

export default function InterviewReview() {
  const { id } = useParams();
  const { data: itv, loading, error, reload } = useFetch(() => interviewsApi.get(id).then((r) => r.data), [id]);
  const appId = itv?.application;
  const { data: app } = useFetch(() => (appId ? applicationsApi.get(appId).then((r) => r.data) : Promise.resolve(null)), [appId]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(null);

  const decide = async (value) => {
    setBusy(value);
    try { const res = await interviewsApi.decide(id, { value, comment, notify: true }); toast.success(`${res.message} E-mail envoyé au candidat.`); reload(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(null); }
  };
  const reevaluate = async () => {
    setBusy('eval');
    try { await interviewsApi.reevaluate(id); toast.success('Entretien réévalué.'); reload(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(null); }
  };
  const openCv = async () => {
    try { const blob = await applicationsApi.cvBlob(appId); window.open(URL.createObjectURL(blob), '_blank', 'noopener'); } catch (err) { toast.error(errorMessage(err)); }
  };

  if (error) return <div className="mx-auto max-w-6xl px-4 py-10"><ErrorState message={error} onRetry={reload} /></div>;
  if (loading || !itv) return <div className="mx-auto max-w-6xl space-y-4 px-4 py-10"><Skeleton className="h-16" /><Skeleton className="h-96" /></div>;
  const ev = itv.status === 'evalue' ? itv.evaluation : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <Link to="/recruteur/entretiens" className="inline-flex items-center gap-1 text-sm text-tw-muted hover:text-tw-ink"><ArrowLeft className="size-4" />Tous les entretiens</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{itv.title}</p>
          <h1 className="mt-1 text-2xl font-semibold">{itv.candidateName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-tw-muted">
            <Pill meta={INTERVIEW_STATUS} value={itv.status} />
            <span>Créneau {fmtDate(itv.scheduledAt)}</span>
            {itv.startedAt && <span>· passé le {fmtDate(itv.startedAt)}</span>}
            <span>· {itv.language === 'en' ? 'anglais' : 'français'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {appId && <Button variant="secondary" size="sm" icon={FileText} onClick={openCv}>CV</Button>}
          {itv.meet?.link && <a href={itv.meet.link} target="_blank" rel="noreferrer"><Button variant="secondary" size="sm" icon={Video}>{itv.meet.provider === 'google' ? 'Google Meet' : 'Jitsi'} <ExternalLink className="size-3" /></Button></a>}
          {['termine', 'evalue'].includes(itv.status) && <Button variant="secondary" size="sm" icon={RefreshCw} loading={busy === 'eval'} onClick={reevaluate}>Réévaluer</Button>}
        </div>
      </div>

      {ev ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="card p-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <ScoreRing value={ev.overall} size={132} label="note globale" />
              <div className="w-full flex-1 divide-y divide-tw-line">
                <ScoreBar label={`Quiz (${Math.round(ev.weights.quiz * 100)} %)`} value={ev.quiz} />
                <ScoreBar label={`Technique (${Math.round(ev.weights.technical * 100)} %)`} value={ev.technical} />
                <ScoreBar label={`Communication (${Math.round(ev.weights.communication * 100)} %)`} value={ev.communication} />
                <ScoreBar label={`Motivation (${Math.round(ev.weights.motivation * 100)} %)`} value={ev.motivation} />
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2"><span className="text-sm text-tw-muted">Avis de l'IA :</span><Pill meta={RECOMMENDATION} value={ev.recommendation} /></div>
            <p className="mt-3 text-sm leading-relaxed">{ev.summary}</p>
            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div><p className="font-semibold text-tw-success">Points forts</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-tw-muted">{ev.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
              <div><p className="font-semibold text-tw-warning">Axes de progrès</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-tw-muted">{ev.improvements.map((s) => <li key={s}>{s}</li>)}</ul></div>
            </div>
            <p className="mt-4 text-[11px] text-tw-muted">Méthode : {ev.method}</p>
          </div>
          <div className="card space-y-3 p-5">
            <p className="font-semibold">Votre décision</p>
            <Pill meta={DECISION} value={itv.decision?.value || 'en_attente'} />
            {itv.decision?.comment && <p className="text-sm text-tw-muted">« {itv.decision.comment} »</p>}
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={1500} placeholder="Message joint à l'e-mail du candidat (facultatif)" className="w-full rounded-lg border border-tw-line bg-tw-surface p-3 text-sm focus:border-tw-accent focus:outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="success" icon={ThumbsUp} loading={busy === 'retenu'} onClick={() => decide('retenu')}>Retenir</Button>
              <Button variant="danger" icon={ThumbsDown} loading={busy === 'non_retenu'} onClick={() => decide('non_retenu')}>Ne pas retenir</Button>
            </div>
            <p className="text-xs text-tw-muted">La recommandation de l'IA est un appui : la décision et l'e-mail au candidat partent de votre clic.</p>
          </div>
        </div>
      ) : (
        <div className="card p-6 text-sm text-tw-muted">{itv.status === 'termine' ? 'Analyse en cours : la page se mettra à jour dans une minute.' : 'L\'évaluation apparaîtra ici une fois l\'entretien passé.'}</div>
      )}

      <h2 className="text-lg font-semibold">Transcriptions et notation</h2>
      {itv.questions.length === 0 && <p className="text-sm text-tw-muted">Les questions sont construites au démarrage de l'entretien, à partir du quiz, du CV et de l'offre.</p>}
      {itv.questions.map((q, i) => {
        const a = itv.answers.find((x) => x.questionIndex === i);
        return (
          <div key={q.order} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="eyebrow">Q{i + 1} · {QUESTION_TYPES[q.type]} · {q.skill} {q.source === 'ia' && <span className="ml-1 rounded bg-tw-tint px-1.5 py-0.5 text-[10px] text-tw-accent">question générée par l'IA</span>}</p>
                <p className="mt-1.5 font-medium">{q.text}</p>
              </div>
              <p className={clsx('text-2xl font-bold tabular', scoreTone(a?.score))}>{a?.score ?? '—'}</p>
            </div>
            <blockquote className="mt-3 rounded-lg border-l-4 border-tw-accent/40 bg-tw-canvas p-3 text-sm">
              {a?.transcript || <span className="text-tw-muted">Pas de réponse.</span>}
              {a && <span className="mt-1.5 block text-[11px] text-tw-muted">{a.inputMode === 'voix' ? `Oral · ${a.durationSec} s · langue détectée : ${a.detectedLanguage}` : 'Écrit'}{a.wordsPerMinute ? ` · ${a.wordsPerMinute} mots/min` : ''}</span>}
            </blockquote>
            {a && (
              <>
                <div className="mt-3 grid grid-cols-2 gap-x-6 text-xs sm:grid-cols-4">
                  {[['Couverture grille', a.scores?.coverage], ['Pertinence', a.scores?.relevance], ['Communication', a.scores?.communication], ['Juge LLM', a.scores?.llm]].map(([l, v]) => (
                    <p key={l} className="flex justify-between border-b border-tw-line py-1.5"><span className="text-tw-muted">{l}</span><strong className={scoreTone(v)}>{v ?? '—'}</strong></p>
                  ))}
                </div>
                <p className="mt-3 flex gap-2 text-sm"><Sparkles className="mt-0.5 size-4 shrink-0 text-tw-accent" />{a.feedback}</p>
              </>
            )}
            <div className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
              <p className="font-semibold text-tw-muted sm:col-span-2">Grille d'attendus</p>
              {q.keyPoints.map((k) => {
                const ok = a?.coveredPoints?.includes(k);
                return <p key={k} className={clsx('flex gap-1.5', ok ? 'text-tw-success' : 'text-tw-muted')}>{ok ? <CheckCircle2 className="size-3.5 shrink-0" /> : <XCircle className="size-3.5 shrink-0" />}{k}</p>;
              })}
            </div>
          </div>
        );
      })}
      {app && <MatchingCard matching={app.matching} title={`CV de ${itv.candidateName}`} />}
    </div>
  );
}
