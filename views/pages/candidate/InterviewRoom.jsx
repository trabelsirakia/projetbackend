import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Camera, CameraOff, CheckCircle2, ExternalLink, Keyboard, Loader2, Mic, MicOff, PhoneOff, Send, Sparkles, Video, XCircle,
} from 'lucide-react';
import Avatar from '../../components/interview/Avatar';
import Button from '../../components/ui/Button';
import { Alert, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { Pill, ScoreBar, ScoreRing } from '../../components/shared';
import useRecorder from '../../hooks/useRecorder';
import { useLiveCaptions, useSpeaker } from '../../hooks/useSpeech';
import useAuth from '../../hooks/useAuth';
import { interviewsApi } from '../../services/api';
import { errorCode, errorMessage } from '../../services/client';
import { DECISION, INTERVIEW_STATUS, QUESTION_TYPES, RECOMMENDATION, fmtDate, scoreTone } from '../../utils/labels';

const PREP_SECONDS = 3; // l'instant laissé au candidat avant de répondre
const SILENCE_MS = 5000;
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const GREETING = {
  fr: (name) => `Bonjour ${name}, je suis Nora, votre intervieweuse virtuelle. Cet entretien dure cinq minutes : je vais vous poser cinq questions. Après chaque question, vous aurez un court instant, puis vous répondrez à voix haute. Prêt ? Commençons.`,
  en: (name) => `Hello ${name}, I am Nora, your virtual interviewer. This interview lasts five minutes: I will ask you five questions. After each question you will have a short moment, then answer out loud. Ready? Let's start.`,
};
const CLOSING = { fr: 'Merci pour vos réponses ! L\'entretien est terminé. J\'analyse maintenant vos réponses.', en: 'Thank you for your answers! The interview is over. I am now analysing your answers.' };

// ---------------- Résultat ----------------
function ResultView({ itv }) {
  const ev = itv.evaluation;
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <Link to="/mes-candidatures" className="inline-flex items-center gap-1 text-sm text-tw-muted hover:text-tw-ink"><ArrowLeft className="size-4" />Mes candidatures</Link>
      <div className="card overflow-hidden">
        <div className="brand-panel flex flex-col items-center gap-6 p-7 sm:flex-row">
          <div className="rounded-full bg-white/95 p-2"><ScoreRing value={ev.overall} size={128} label="/100" /></div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Résultat de l'entretien</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">{itv.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2"><Pill meta={RECOMMENDATION} value={ev.recommendation} /><Pill meta={DECISION} value={itv.decision?.value || 'en_attente'} /></div>
            <p className="mt-3 text-sm text-white/80">La décision finale appartient au recruteur : vous recevrez un e-mail.</p>
          </div>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-2">
          <div className="divide-y divide-tw-line">
            <ScoreBar label={`Quiz (${Math.round(ev.weights.quiz * 100)} %)`} value={ev.quiz} />
            <ScoreBar label={`Technique (${Math.round(ev.weights.technical * 100)} %)`} value={ev.technical} />
            <ScoreBar label={`Communication (${Math.round(ev.weights.communication * 100)} %)`} value={ev.communication} />
            <ScoreBar label={`Motivation (${Math.round(ev.weights.motivation * 100)} %)`} value={ev.motivation} />
          </div>
          <div className="space-y-3 text-sm">
            <p className="leading-relaxed">{ev.summary}</p>
            {ev.strengths?.length > 0 && <div><p className="font-semibold text-tw-success">Points forts</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-tw-muted">{ev.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>}
            {ev.improvements?.length > 0 && <div><p className="font-semibold text-tw-warning">À travailler</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-tw-muted">{ev.improvements.map((s) => <li key={s}>{s}</li>)}</ul></div>}
          </div>
        </div>
      </div>
      <h2 className="text-lg font-semibold">Question par question</h2>
      {itv.questions.map((q, i) => {
        const a = itv.answers.find((x) => x.questionIndex === i);
        return (
          <div key={q.order} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow">Q{i + 1} · {QUESTION_TYPES[q.type]} · {q.skill}</p>
              <p className={clsx('text-lg font-bold tabular', scoreTone(a?.score))}>{a?.score ?? 0}<span className="text-sm text-tw-muted">/100</span></p>
            </div>
            <p className="mt-2 font-medium">{q.text}</p>
            <blockquote className="mt-3 rounded-lg border-l-4 border-tw-accent/40 bg-tw-canvas p-3 text-sm italic text-tw-muted">
              {a?.transcript || 'Pas de réponse.'}
              {a && <span className="mt-1 block text-[11px] not-italic">{a.inputMode === 'voix' ? `Réponse orale · ${a.durationSec} s · langue ${a.detectedLanguage}` : 'Réponse écrite'}{a.wordsPerMinute ? ` · ${a.wordsPerMinute} mots/min` : ''}</span>}
            </blockquote>
            {a?.feedback && <p className="mt-3 flex gap-2 text-sm"><Sparkles className="mt-0.5 size-4 shrink-0 text-tw-accent" />{a.feedback}</p>}
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div>{(a?.coveredPoints || []).map((p) => <p key={p} className="flex gap-1.5 text-tw-success"><CheckCircle2 className="size-3.5 shrink-0" />{p}</p>)}</div>
              <div>{(a?.missedPoints || []).map((p) => <p key={p} className="flex gap-1.5 text-tw-muted"><XCircle className="size-3.5 shrink-0" />{p}</p>)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Salle ----------------
export default function InterviewRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [itv, setItv] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | lobby | running | analysing | result | closed
  const [language, setLanguage] = useState(user?.preferredLanguage || 'fr');
  const [mode, setMode] = useState('voix'); // voix | texte
  const [stream, setStream] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  const [camOn, setCamOn] = useState(true);
  const [step, setStep] = useState({ index: 0, sub: 'idle', countdown: 0 }); // sub : speaking | prep | recording | sending | idle
  const [questionStart, setQuestionStart] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [typed, setTyped] = useState('');
  const [starting, setStarting] = useState(false);
  const [sent, setSent] = useState([]);
  const videoRef = useRef(null);
  const abortRef = useRef(false);
  const manualStop = useRef(null);
  const textSubmit = useRef(null);

  const recorder = useRecorder(stream);
  const speaker = useSpeaker();
  const captions = useLiveCaptions(language);

  const load = useCallback(async () => {
    try {
      const res = await interviewsApi.get(id);
      setItv(res.data);
      setPhase(res.data.status === 'evalue' ? 'result' : res.data.status === 'termine' ? 'analysing' : ['planifie', 'en_cours'].includes(res.data.status) ? 'lobby' : 'closed');
      if (res.data.language) setLanguage(res.data.language);
      return res.data;
    } catch (err) {
      setLoadError(errorMessage(err));
      return null;
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Caméra + micro (dans le salon et pendant l'entretien).
  const openMedia = useCallback(async () => {
    setMediaError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }, video: { width: 640, height: 480 } });
      setStream(s);
    } catch {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStream(s);
        setCamOn(false);
        setMediaError('Caméra indisponible : l\'entretien se fera en audio seul.');
      } catch {
        setMediaError('Micro inaccessible : autorisez-le dans le navigateur, ou répondez par écrit.');
        setMode('texte');
      }
    }
  }, []);
  useEffect(() => { if (phase === 'lobby' && !stream) openMedia(); }, [phase, stream, openMedia]);
  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream, phase, camOn]);
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);
  useEffect(() => { stream?.getVideoTracks().forEach((t) => { t.enabled = camOn; }); }, [camOn, stream]);
  useEffect(() => () => { abortRef.current = true; }, []);

  useEffect(() => {
    if (phase !== 'running') return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase]);

  // Analyse : on interroge le serveur jusqu'à l'évaluation.
  useEffect(() => {
    if (phase !== 'analysing') return undefined;
    let stop = false;
    (async () => {
      for (let i = 0; i < 120 && !stop; i += 1) {
        await wait(3000);
        const res = await interviewsApi.get(id).catch(() => null);
        if (res?.data.status === 'evalue') { setItv(res.data); setPhase('result'); return; }
      }
    })();
    return () => { stop = true; };
  }, [phase, id]);

  const deadline = itv?.startedAt ? new Date(itv.startedAt).getTime() + itv.durationMinutes * 60000 : 0;
  const remaining = deadline - now;

  /** Envoie une réponse (en arrière-plan : la question suivante démarre aussitôt). */
  const sendAnswer = useCallback(async (index, payload) => {
    setSent((s) => [...s, { index, status: 'sending' }]);
    try {
      if (payload.wav) await interviewsApi.answerAudio(id, { questionIndex: index, wav: payload.wav, durationSec: payload.durationSec, liveTranscript: payload.live });
      else await interviewsApi.answerText(id, index, payload.text);
      setSent((s) => s.map((x) => (x.index === index ? { ...x, status: 'ok' } : x)));
    } catch (err) {
      if (errorCode(err) !== 'ALREADY_ANSWERED') toast.error(`Réponse ${index + 1} : ${errorMessage(err)}`);
      setSent((s) => s.map((x) => (x.index === index ? { ...x, status: 'error' } : x)));
    }
  }, [id]);

  const runInterview = useCallback(async (data) => {
    const lang = data.language;
    const answered = new Set(data.answers.map((a) => a.questionIndex));
    const end = new Date(data.startedAt).getTime() + data.durationMinutes * 60000;
    if (!answered.size) {
      setStep({ index: 0, sub: 'speaking', countdown: 0 });
      await speaker.speak(GREETING[lang](user.firstName), lang);
    }
    for (let i = 0; i < data.questions.length; i += 1) {
      if (abortRef.current) return;
      if (answered.has(i)) continue;
      if (Date.now() > end) break;
      const q = data.questions[i];
      setTyped('');
      setStep({ index: i, sub: 'speaking', countdown: 0 });
      await speaker.speak(q.text, lang);
      for (let c = PREP_SECONDS; c > 0; c -= 1) {
        if (abortRef.current) return;
        setStep({ index: i, sub: 'prep', countdown: c });
        await wait(1000);
      }
      const maxMs = Math.min(q.timeLimitSec * 1000, Math.max(5000, end - Date.now()));
      setQuestionStart(Date.now());
      setStep({ index: i, sub: 'recording', countdown: 0 });
      if (mode === 'voix') {
        captions.start();
        await Promise.race([recorder.start({ maxMs, silenceMs: SILENCE_MS }), new Promise((r) => { manualStop.current = r; })]);
        const live = captions.stop();
        const rec = recorder.stop();
        sendAnswer(i, rec.spoke || live ? { wav: rec.wav, durationSec: rec.durationSec, live } : { text: '(aucune réponse orale détectée)' });
      } else {
        const text = await Promise.race([new Promise((r) => { textSubmit.current = r; }), wait(maxMs).then(() => null)]);
        sendAnswer(i, { text: (text ?? document.getElementById('typed-answer')?.value ?? '').trim() || '(pas de réponse écrite)' });
      }
      setStep({ index: i, sub: 'sending', countdown: 0 });
      await wait(600);
    }
    if (abortRef.current) return;
    setStep((s) => ({ ...s, sub: 'speaking' }));
    await speaker.speak(CLOSING[lang], lang);
    await wait(800); // laisse partir le dernier envoi
    try { await interviewsApi.finish(id); } catch (err) { if (errorCode(err) !== 'INVALID_STATUS') toast.error(errorMessage(err)); }
    stream?.getTracks().forEach((t) => t.stop());
    setPhase('analysing');
  }, [captions, id, mode, recorder, sendAnswer, speaker, stream, user]);

  const begin = async () => {
    setStarting(true);
    try {
      const res = await interviewsApi.start(id, language);
      setItv(res.data.interview);
      setPhase('running');
      abortRef.current = false;
      runInterview(res.data.interview);
    } catch (err) {
      toast.error(errorMessage(err));
      if (errorCode(err) === 'QUIZ_REQUIRED') navigate(`/quiz/${itv.application}`);
    } finally {
      setStarting(false);
    }
  };

  const quit = () => {
    abortRef.current = true;
    speaker.cancel();
    stream?.getTracks().forEach((t) => t.stop());
    navigate('/mes-candidatures');
  };

  // ------------- Rendu -------------
  if (loadError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState message={loadError} onRetry={load} /></div>;
  if (phase === 'loading' || !itv) return <div className="mx-auto max-w-5xl space-y-4 px-4 py-10"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>;
  if (phase === 'result') return <ResultView itv={itv} />;

  if (phase === 'closed') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="warning" title={`Entretien ${INTERVIEW_STATUS[itv.status]?.label.toLowerCase()}`}>Cet entretien n'est plus accessible. Consultez vos candidatures pour la suite.</Alert>
        <Link to="/mes-candidatures" className="mt-4 inline-block text-sm text-tw-accent">← Mes candidatures</Link>
      </div>
    );
  }

  if (phase === 'analysing') {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0B1828] px-4 text-white">
        <div className="max-w-md text-center">
          <Avatar state="thinking" className="mx-auto size-44 overflow-hidden rounded-full ring-4 ring-white/10" />
          <h1 className="mt-6 text-2xl font-semibold">Analyse de vos réponses…</h1>
          <p className="mt-2 text-sm text-white/70">Transcription (Whisper), comparaison avec la grille du métier et synthèse : environ une minute. Vous pouvez quitter cette page, le résultat sera dans votre espace.</p>
          <Loader2 className="mx-auto mt-6 size-6 animate-spin text-[#7DB8FF]" />
          <Link to="/mes-candidatures" className="mt-6 inline-block text-sm text-[#7DB8FF] hover:underline">Retour à mes candidatures</Link>
        </div>
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Link to="/mes-candidatures" className="inline-flex items-center gap-1 text-sm text-tw-muted hover:text-tw-ink"><ArrowLeft className="size-4" />Mes candidatures</Link>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="card overflow-hidden">
            <div className="relative aspect-video bg-[#0B1828]">
              {stream && camOn ? <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" /> : (
                <div className="grid h-full place-items-center text-white/60"><CameraOff className="size-10" /></div>
              )}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white">
                <Mic className="size-3.5" />
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/20"><span className="block h-full bg-[#52C38D] transition-[width] duration-75" style={{ width: `${recorder.level * 100}%` }} /></span>
                <span>{recorder.level > 0.05 ? 'On vous entend' : 'Parlez pour tester'}</span>
              </div>
              <button type="button" onClick={() => setCamOn((c) => !c)} className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-lg bg-black/50 text-white" aria-label={camOn ? 'Couper la caméra' : 'Activer la caméra'}>
                {camOn ? <Camera className="size-4" /> : <CameraOff className="size-4" />}
              </button>
            </div>
            {mediaError && <div className="p-4"><Alert tone="warning">{mediaError}</Alert></div>}
          </div>
          <div className="space-y-5">
            <div>
              <p className="eyebrow">Étape 3 · Entretien vidéo</p>
              <h1 className="mt-2 text-2xl font-semibold">{itv.title}</h1>
              <p className="mt-1 text-sm text-tw-muted">5 minutes · 5 questions posées à voix haute par Nora, notre avatar IA.</p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-medium">Langue de l'entretien</p>
              <div className="grid grid-cols-2 gap-2">
                {[['fr', 'Français'], ['en', 'English']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setLanguage(v)} className={clsx('rounded-lg border px-3 py-2.5 text-sm', language === v ? 'border-tw-accent bg-tw-tint font-medium text-tw-accent' : 'border-tw-line hover:bg-tw-canvas')}>{l}</button>
                ))}
              </div>
              <p className="text-xs text-tw-muted">Vous pouvez répondre dans l'une ou l'autre langue : elle est détectée à chaque réponse.</p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-medium">Mode de réponse</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={!stream} onClick={() => setMode('voix')} className={clsx('flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 disabled:opacity-50', mode === 'voix' ? 'border-tw-accent bg-tw-tint font-medium text-tw-accent' : 'border-tw-line')}><Mic className="size-4" />À l'oral</button>
                <button type="button" onClick={() => setMode('texte')} className={clsx('flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5', mode === 'texte' ? 'border-tw-accent bg-tw-tint font-medium text-tw-accent' : 'border-tw-line')}><Keyboard className="size-4" />À l'écrit</button>
              </div>
            </div>
            <ul className="space-y-1.5 rounded-lg bg-tw-canvas p-4 text-sm text-tw-muted">
              <li>• Après chaque question : {PREP_SECONDS} secondes pour vous préparer, puis environ une minute pour répondre.</li>
              <li>• Arrêt automatique après {SILENCE_MS / 1000} s de silence, ou bouton « J'ai terminé ».</li>
              <li>• Un endroit calme et Chrome ou Edge donnent les meilleurs résultats.</li>
            </ul>
            {itv.meet?.link && (
              <a href={itv.meet.link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-tw-accent hover:underline">
                <Video className="size-4" />Visio avec le recruteur ({itv.meet.provider === 'google' ? 'Google Meet' : 'Jitsi Meet'}) — {fmtDate(itv.scheduledAt)}<ExternalLink className="size-3.5" />
              </a>
            )}
            {<Button size="lg" className="w-full" onClick={begin} loading={starting} disabled={mode === 'voix' && !stream}>{itv.status === 'en_cours' ? 'Reprendre l\'entretien' : 'Commencer l\'entretien'}</Button>}
            <p className="text-center text-xs text-tw-muted">Accessible jusqu'au {fmtDate(itv.expiresAt)}</p>
          </div>
        </div>
      </div>
    );
  }

  // ---- En cours ----
  const q = itv.questions[step.index];
  const avatarState = step.sub === 'speaking' ? 'speaking' : step.sub === 'recording' ? 'listening' : step.sub === 'sending' ? 'thinking' : 'idle';
  const qElapsed = step.sub === 'recording' ? now - questionStart : 0;
  const qLeft = q ? q.timeLimitSec * 1000 - qElapsed : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-[#070F1A] text-white">
      <header className="flex items-center gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 text-sm"><span className="size-2.5 animate-pulse rounded-full bg-red-500" />REC</span>
        <p className="hidden truncate text-sm text-white/70 sm:block">{itv.title}</p>
        <p className="ml-auto text-sm text-white/70">Question {Math.min(step.index + 1, itv.questions.length)}/{itv.questions.length}</p>
        <p className={clsx('rounded-md px-2.5 py-1 font-mono text-sm tabular', remaining < 60000 ? 'bg-red-500/20 text-red-300' : 'bg-white/10')}>{clock(remaining)}</p>
      </header>

      <div className="grid flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_340px]">
        <div className="relative overflow-hidden rounded-2xl bg-[#0B1828] ring-1 ring-white/10">
          <Avatar state={avatarState} pulse={speaker.pulse} className="mx-auto aspect-square h-full max-h-[62vh]" />
          <div className="absolute left-4 top-4 rounded-lg bg-black/45 px-3 py-1.5 text-xs">Nora · intervieweuse IA</div>
          {step.sub === 'recording' && <div className={clsx('absolute inset-0 rounded-2xl ring-4 transition-opacity', recorder.spoke ? 'ring-[#52C38D]/60' : 'ring-[#52C38D]/25')} aria-hidden />}
          <AnimatePresence>
            {step.sub === 'prep' && (
              <motion.div key={step.countdown} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center bg-black/35">
                <div className="text-center"><p className="text-7xl font-bold">{step.countdown}</p><p className="mt-2 text-sm text-white/80">{language === 'en' ? 'Get ready to answer…' : 'Préparez votre réponse…'}</p></div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/60 to-transparent p-5 pt-16">
            {q && <p className="text-center text-lg font-medium leading-snug sm:text-xl">{q.text}</p>}
            {step.sub === 'recording' && mode === 'voix' && (
              <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-[#9fd3ff]">{captions.text || (captions.supported ? (language === 'en' ? 'Listening…' : 'Je vous écoute…') : (language === 'en' ? 'Speak now' : 'Parlez maintenant'))}</p>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
            {stream && camOn ? <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" /> : <div className="grid h-full place-items-center text-white/40"><CameraOff className="size-8" /></div>}
            <div className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-1 text-xs">{user.firstName}</div>
            <div className="absolute bottom-2 right-2 flex items-end gap-0.5" aria-hidden>
              {[0.2, 0.45, 0.7, 0.95].map((t) => <span key={t} className={clsx('w-1 rounded-sm', recorder.level > t * 0.5 ? 'bg-[#52C38D]' : 'bg-white/25')} style={{ height: `${6 + t * 14}px` }} />)}
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            {step.sub === 'recording' ? (
              mode === 'voix' ? (
                <>
                  <p className="flex items-center gap-2 text-sm font-medium"><Mic className="size-4 text-[#52C38D]" />{language === 'en' ? 'Your answer is being recorded' : 'Votre réponse est enregistrée'}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#52C38D]" style={{ width: `${Math.min(100, (qElapsed / (q.timeLimitSec * 1000)) * 100)}%` }} /></div>
                  <p className="mt-2 text-xs text-white/60">{clock(qLeft)} restantes · arrêt auto après {SILENCE_MS / 1000} s de silence</p>
                  <Button variant="success" className="mt-4 w-full" icon={CheckCircle2} onClick={() => manualStop.current?.('manuel')}>J'ai terminé</Button>
                </>
              ) : (
                <>
                  <label htmlFor="typed-answer" className="text-sm font-medium">{language === 'en' ? 'Your answer' : 'Votre réponse'} · {clock(qLeft)}</label>
                  <textarea id="typed-answer" value={typed} onChange={(e) => setTyped(e.target.value)} rows={6} autoFocus className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 p-3 text-sm text-white focus:border-[#7DB8FF] focus:outline-none" />
                  <Button className="mt-3 w-full" icon={Send} onClick={() => textSubmit.current?.(typed)}>Envoyer</Button>
                </>
              )
            ) : (
              <p className="text-sm text-white/70">{step.sub === 'speaking' ? (language === 'en' ? 'Nora is speaking…' : 'Nora parle…') : step.sub === 'prep' ? (language === 'en' ? 'Your turn in a moment' : 'À vous dans un instant') : (language === 'en' ? 'Answer received' : 'Réponse reçue')}</p>
            )}
          </div>

          <div className="rounded-2xl bg-white/5 p-4 text-xs ring-1 ring-white/10">
            <p className="mb-2 font-medium text-white/80">Réponses envoyées</p>
            <div className="flex gap-2">
              {itv.questions.map((qq, i) => {
                const s = sent.find((x) => x.index === i);
                return <span key={qq.order} className={clsx('grid size-8 place-items-center rounded-lg font-semibold', s?.status === 'ok' ? 'bg-[#1E7A4E]' : s?.status === 'sending' ? 'bg-white/20' : s?.status === 'error' ? 'bg-red-500/40' : i === step.index ? 'bg-[#2A6BC2]' : 'bg-white/5')} title={s?.status}>{s?.status === 'sending' ? <Loader2 className="size-3.5 animate-spin" /> : i + 1}</span>;
              })}
            </div>
          </div>
          <button type="button" onClick={quit} className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-red-600/90 px-4 py-2.5 text-sm font-medium hover:bg-red-600"><PhoneOff className="size-4" />Quitter (reprise possible)</button>
          {!stream && mode === 'voix' && <p className="flex items-center gap-1 text-xs text-red-300"><MicOff className="size-3.5" />Micro coupé</p>}
        </aside>
      </div>
    </div>
  );
}
