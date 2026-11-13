import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Send, Timer, Video, XCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Alert, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { ConfirmDialog } from '../../components/ui/Modal';
import { ScoreBar, ScoreRing } from '../../components/shared';
import useFetch from '../../hooks/useFetch';
import { applicationsApi, quizzesApi } from '../../services/api';
import { errorMessage } from '../../services/client';

const LETTERS = 'ABCDEF';
const fmtClock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function Results({ result, interviewId }) {
  const { attempt, correction, passingScore } = result;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="card flex flex-col items-center gap-6 p-6 sm:flex-row">
        <ScoreRing value={attempt.percent} label={attempt.passed ? 'réussi' : `seuil ${passingScore}`} />
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{attempt.status === 'expiree' ? 'Temps écoulé : quiz envoyé' : attempt.passed ? 'Bravo, quiz réussi !' : 'Quiz terminé'}</h2>
          <p className="mt-1 text-sm text-tw-muted">{attempt.score}/{attempt.maxScore} points. L'avatar reviendra pendant l'entretien sur vos compétences les plus faibles : c'est l'occasion de montrer ce que vous savez à l'oral.</p>
          <div className="mt-3 divide-y divide-tw-line">{attempt.perSkill.map((s) => <ScoreBar key={s.skill} label={s.skill} value={s.percent} />)}</div>
        </div>
      </div>
      {interviewId && (
        <div className="brand-panel flex flex-col items-start justify-between gap-4 rounded-2xl p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold text-white">Étape suivante : l'entretien vidéo de 5 minutes</p>
            <p className="text-sm text-white/75">Micro et caméra prêts ? Vous pouvez le passer maintenant ou plus tard.</p>
          </div>
          <Link to={`/entretien/${interviewId}`} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 font-semibold text-[#0F2238]"><Video className="size-4" />Ouvrir la salle</Link>
        </div>
      )}
      <div className="space-y-3">
        <h3 className="font-semibold">Correction</h3>
        {correction.map((c, i) => (
          <div key={c.questionId} className="card p-4">
            <p className="flex gap-2 text-sm font-medium">{c.correct ? <CheckCircle2 className="size-5 shrink-0 text-tw-success" /> : <XCircle className="size-5 shrink-0 text-tw-danger" />}<span>{i + 1}. {c.text}</span></p>
            <ul className="mt-3 grid gap-1.5 pl-7 text-sm">
              {c.options.map((o, j) => (
                <li key={o} className={clsx('rounded-md px-2.5 py-1.5', j === c.correctIndex ? 'bg-tw-success-soft text-tw-success' : j === c.selectedIndex ? 'bg-tw-danger-soft text-tw-danger' : 'text-tw-muted')}>
                  {LETTERS[j]}. {o}{j === c.selectedIndex ? ' — votre réponse' : ''}
                </li>
              ))}
            </ul>
            {c.explanation && <p className="mt-2 pl-7 text-xs text-tw-muted">{c.explanation}</p>}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function QuizPage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const { data: ov, loading, error, reload } = useFetch(() => applicationsApi.quiz(applicationId).then((r) => r.data), [applicationId]);
  const { data: app } = useFetch(() => applicationsApi.get(applicationId).then((r) => r.data), [applicationId]);
  const [session, setSession] = useState(null); // { attempt, questions }
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState(null);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const shownAt = useRef(Date.now());
  const times = useRef({});
  const sentRef = useRef(false);

  const deadline = session ? new Date(session.attempt.deadlineAt).getTime() : 0;
  const remaining = deadline - now;

  useEffect(() => {
    if (!session || result) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [session, result]);

  const start = async () => {
    setStarting(true);
    try {
      const res = await applicationsApi.startQuiz(applicationId);
      setSession(res.data);
      if (res.data.resumed) toast('Reprise de votre quiz en cours.');
      shownAt.current = Date.now();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  const track = () => {
    const q = session?.questions[index];
    if (q) times.current[q.id] = (times.current[q.id] || 0) + (Date.now() - shownAt.current);
    shownAt.current = Date.now();
  };

  const submit = useCallback(async () => {
    if (sentRef.current || !session) return;
    sentRef.current = true;
    setSending(true);
    setConfirm(false);
    track();
    try {
      const payload = session.questions.map((q) => ({ questionId: q.id, selectedIndex: answers[q.id] ?? null, timeMs: Math.round(times.current[q.id] || 0) }));
      const res = await quizzesApi.submit(session.attempt.id, payload);
      setResult(res.data);
      toast.success(res.message);
    } catch (err) {
      sentRef.current = false;
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, answers]);

  // Envoi automatique à la fin du chrono.
  useEffect(() => { if (session && !result && remaining <= 0) submit(); }, [remaining, session, result, submit]);

  // Clavier : A-F pour répondre, flèches pour naviguer.
  useEffect(() => {
    if (!session || result) return undefined;
    const onKey = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      const q = session.questions[index];
      const k = e.key.toUpperCase();
      const j = LETTERS.indexOf(k);
      if (j >= 0 && j < q.options.length) setAnswers((a) => ({ ...a, [q.id]: j }));
      if (e.key === 'ArrowRight' && index < session.questions.length - 1) { track(); setIndex((i) => i + 1); }
      if (e.key === 'ArrowLeft' && index > 0) { track(); setIndex((i) => i - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, index, result]);

  const interviewId = app?.interview?.id || app?.interview?._id;

  if (error) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState message={error} onRetry={reload} /></div>;
  if (loading || !ov) return <div className="mx-auto max-w-3xl space-y-4 px-4 py-10"><Skeleton className="h-10" /><Skeleton className="h-72" /></div>;

  const done = ov.attempts.find((a) => a.status !== 'en_cours');
  if (result) return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6"><Results result={result} interviewId={interviewId} /></div>;

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-tw-muted hover:text-tw-ink"><ArrowLeft className="size-4" />Retour</button>
        <div className="card overflow-hidden">
          <div className="brand-panel p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Étape 2 · Quiz de compétences</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{ov.quiz.title}</h1>
            {app && <p className="mt-1 text-sm text-white/75">{app.job.title}</p>}
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3">
            <div><p className="text-xs text-tw-muted">Durée</p><p className="flex items-center gap-1.5 text-lg font-semibold"><Timer className="size-4 text-tw-accent" />{ov.quiz.durationMinutes} min</p></div>
            <div><p className="text-xs text-tw-muted">Questions</p><p className="text-lg font-semibold">{ov.quiz.questionCount}</p></div>
            <div><p className="text-xs text-tw-muted">Réussite</p><p className="text-lg font-semibold">{ov.quiz.passingScore} %</p></div>
          </div>
          <div className="space-y-3 border-t border-tw-line p-6 text-sm text-tw-muted">
            <p>Compétences évaluées : <span className="text-tw-ink">{ov.quiz.skills.join(', ')}</span></p>
            <p>Une seule tentative. Le chrono démarre dès que vous cliquez ; le quiz est envoyé automatiquement à la fin du temps. Raccourcis : touches A à D pour répondre, flèches pour naviguer.</p>
          </div>
          <div className="border-t border-tw-line p-6">
            {done ? (
              <Alert tone="info" title={`Quiz déjà passé : ${done.percent}/100`}>
                <Button className="mt-3" size="sm" onClick={async () => setResult((await quizzesApi.attempt(done.id)).data)}>Voir ma correction</Button>
              </Alert>
            ) : ov.canStart ? (
              <Button size="lg" onClick={start} loading={starting}>Commencer le quiz <ArrowRight className="size-4" /></Button>
            ) : <Alert tone="warning">Le quiz n'est pas disponible pour cette candidature.</Alert>}
          </div>
        </div>
      </div>
    );
  }

  const q = session.questions[index];
  const answered = Object.keys(answers).length;
  const total = session.questions.length;
  const low = remaining < 60000;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-tw-line bg-tw-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium">Question {index + 1}/{total} <span className="text-tw-muted">· {answered} répondue(s)</span></p>
          <p className={clsx('flex items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-lg font-semibold tabular', low ? 'animate-pulse bg-tw-danger-soft text-tw-danger' : 'bg-tw-surface ring-1 ring-tw-line')} role="timer" aria-live={low ? 'polite' : 'off'}>
            <Clock className="size-4" />{fmtClock(remaining)}
          </p>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-tw-line"><div className="h-full bg-tw-primary transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="card p-6">
          <p className="eyebrow">{q.skill} · {q.points} pt{q.points > 1 ? 's' : ''}</p>
          <h2 className="mt-2 text-lg font-semibold leading-snug">{q.text}</h2>
          <div className="mt-5 grid gap-2.5" role="radiogroup" aria-label="Réponses">
            {q.options.map((o, j) => {
              const selected = answers[q.id] === j;
              return (
                <button key={o} type="button" role="radio" aria-checked={selected} onClick={() => setAnswers((a) => ({ ...a, [q.id]: j }))}
                  className={clsx('flex items-center gap-3 rounded-lg border p-3.5 text-left text-sm transition-all', selected ? 'border-tw-accent bg-tw-tint ring-2 ring-tw-accent/20' : 'border-tw-line hover:border-tw-accent/40 hover:bg-tw-canvas')}>
                  <span className={clsx('grid size-7 shrink-0 place-items-center rounded-md text-xs font-semibold', selected ? 'bg-tw-primary text-white' : 'bg-tw-canvas text-tw-muted ring-1 ring-tw-line')}>{LETTERS[j]}</span>
                  {o}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => { track(); setIndex((i) => i - 1); }} disabled={index === 0}><ArrowLeft className="size-4" />Précédente</Button>
        <div className="hidden gap-1 sm:flex">
          {session.questions.map((qq, j) => (
            <button key={qq.id} type="button" onClick={() => { track(); setIndex(j); }} aria-label={`Question ${j + 1}`}
              className={clsx('size-2.5 rounded-full', j === index ? 'bg-tw-primary' : answers[qq.id] != null ? 'bg-tw-accent/50' : 'bg-tw-line')} />
          ))}
        </div>
        {index < total - 1
          ? <Button onClick={() => { track(); setIndex((i) => i + 1); }}>Suivante<ArrowRight className="size-4" /></Button>
          : <Button variant="success" icon={Send} loading={sending} onClick={() => (answered < total ? setConfirm(true) : submit())}>Envoyer</Button>}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={submit} tone="primary" title="Envoyer le quiz ?" confirmLabel="Envoyer" busy={sending}>
        {total - answered} question(s) sans réponse compteront comme fausses.
      </ConfirmDialog>
    </div>
  );
}
