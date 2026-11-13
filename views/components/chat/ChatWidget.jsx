import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { Dumbbell, MessageCircle, Send, Sparkles, Wrench, X } from 'lucide-react';
import { chatbotApi } from '../../services/api';
import { errorMessage } from '../../services/client';
import { METIERS } from '../../utils/labels';

const SUGGESTIONS = ['Où en est ma candidature ?', 'Comment se passe l\'entretien avec l\'avatar ?', 'Comment est calculé mon score ?', 'Entraîne-moi à une question d\'entretien'];
const TOOL_LABELS = { mes_candidatures: 'vos candidatures', mon_entretien: 'votre entretien', mon_quiz: 'votre quiz', offres_ouvertes: 'les offres', question_entrainement: 'banque de questions', evaluer_reponse: 'correcteur' };

/**
 * Assistant « Nora » : agent RAG avec outils (ses réponses citent leurs sources et indiquent les outils utilisés)
 * + mode Entraînement : une vraie question d'entretien du métier, notée par le même correcteur que l'entretien.
 */
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('chat');
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Bonjour ! Je suis Nora. Posez-moi vos questions sur votre candidature, le quiz ou l\'entretien vidéo — ou entraînez-vous avec moi.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [metier, setMetier] = useState('dev-fullstack');
  const [practice, setPractice] = useState(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const end = useRef(null);

  // Accolades : scrollIntoView renvoie une Promise dans les Chromium récents, que React prendrait pour un « cleanup ».
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy, open]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput('');
    const history = messages.slice(1).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setBusy(true);
    try {
      const res = await chatbotApi.send(message, history);
      setMessages((m) => [...m, { role: 'assistant', content: res.data.answer, sources: res.data.sources, tools: res.data.tools, mode: res.data.mode }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: errorMessage(err), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const newQuestion = async () => {
    setFeedback(null);
    setAnswer('');
    setPractice((await chatbotApi.practice(metier)).data);
  };
  const evaluate = async () => {
    setBusy(true);
    try { setFeedback((await chatbotApi.evaluate(practice.question, answer)).data); } catch (err) { setFeedback({ error: errorMessage(err) }); } finally { setBusy(false); }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} className="fixed bottom-5 right-5 z-50 grid size-14 place-items-center rounded-full bg-tw-primary text-white shadow-[var(--shadow-lift)] transition-transform hover:scale-105" aria-label={open ? 'Fermer l\'assistant' : 'Ouvrir l\'assistant'}>
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.section initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.18 }}
            className="card fixed bottom-24 right-4 z-50 flex h-[min(620px,calc(100dvh-8rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden shadow-[var(--shadow-lift)]" aria-label="Assistant Nora">
            <header className="brand-panel flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 place-items-center rounded-full bg-white/15"><Sparkles className="size-4" /></span>
              <div className="flex-1"><p className="text-sm font-semibold text-white">Nora · assistante</p><p className="text-[11px] text-white/65">IA locale (Llama 3.1) · RAG + outils</p></div>
            </header>
            <div className="flex border-b border-tw-line text-sm">
              {[['chat', 'Questions', MessageCircle], ['practice', 'Entraînement', Dumbbell]].map(([k, l, I]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={clsx('flex flex-1 items-center justify-center gap-1.5 py-2.5', tab === k ? 'border-b-2 border-tw-accent font-medium text-tw-accent' : 'text-tw-muted')}><I className="size-4" />{l}</button>
              ))}
            </div>
            {tab === 'chat' ? (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map((m, i) => (
                    <div key={i} className={clsx('max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed', m.role === 'user' ? 'ml-auto bg-tw-primary text-white' : m.error ? 'bg-tw-danger-soft text-tw-danger' : 'bg-tw-canvas')}>
                      <p className="whitespace-pre-line">{m.content}</p>
                      {(m.tools?.length > 0 || m.sources?.length > 0) && (
                        <div className="mt-2 space-y-1 border-t border-tw-line pt-2 text-[11px] text-tw-muted">
                          {m.tools?.length > 0 && <p className="flex items-center gap-1"><Wrench className="size-3" />Consulté : {m.tools.map((t) => TOOL_LABELS[t.tool] || t.tool).join(', ')}</p>}
                          {m.sources?.length > 0 && <p>Sources : {m.sources.slice(0, 3).map((s) => `[${s.n}] ${s.title}`).join(' · ')}</p>}
                          {m.mode === 'extractif' && <p>Mode simplifié (IA générative indisponible)</p>}
                        </div>
                      )}
                    </div>
                  ))}
                  {busy && <div className="flex w-16 gap-1 rounded-2xl bg-tw-canvas px-4 py-3">{[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-tw-muted" style={{ animationDelay: `${i * 120}ms` }} />)}</div>}
                  {messages.length === 1 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-tw-line px-3 py-1.5 text-xs hover:border-tw-accent/50 hover:text-tw-accent">{s}</button>)}
                    </div>
                  )}
                  <div ref={end} />
                </div>
                <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-tw-line p-3">
                  <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} placeholder="Votre question…" className="h-10 flex-1 rounded-lg border border-tw-line bg-tw-surface px-3 text-sm focus:border-tw-accent focus:outline-none" aria-label="Message" />
                  <button type="submit" disabled={busy || !input.trim()} className="grid size-10 place-items-center rounded-lg bg-tw-primary text-white disabled:opacity-50" aria-label="Envoyer"><Send className="size-4" /></button>
                </form>
              </>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
                <div className="flex gap-2">
                  <select value={metier} onChange={(e) => setMetier(e.target.value)} className="h-10 flex-1 rounded-lg border border-tw-line bg-tw-surface px-2 text-sm" aria-label="Métier">
                    {Object.entries(METIERS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <button type="button" onClick={newQuestion} className="rounded-lg bg-tw-primary px-3 text-sm font-medium text-white">{practice ? 'Autre question' : 'Une question'}</button>
                </div>
                {practice && (
                  <>
                    <div className="rounded-xl bg-tw-tint p-3.5"><p className="text-[11px] font-semibold uppercase text-tw-accent">{practice.competence}</p><p className="mt-1 font-medium">{practice.question}</p></div>
                    <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} placeholder="Répondez comme à l'oral, en 4 à 6 phrases…" className="w-full rounded-lg border border-tw-line bg-tw-surface p-3 focus:border-tw-accent focus:outline-none" />
                    <button type="button" disabled={busy || answer.trim().length < 10} onClick={evaluate} className="w-full rounded-lg bg-tw-primary py-2.5 font-medium text-white disabled:opacity-50">{busy ? 'Évaluation…' : 'Évaluer ma réponse'}</button>
                    {feedback && (feedback.error ? <p className="text-tw-danger">{feedback.error}</p> : (
                      <div className="space-y-2 rounded-xl border border-tw-line p-3.5">
                        <p className="text-2xl font-bold tabular">{feedback.note}<span className="text-sm text-tw-muted">/100</span></p>
                        <p>{feedback.conseil}</p>
                        {feedback.points_couverts?.length > 0 && <p className="text-xs text-tw-success">✓ {feedback.points_couverts.join(' · ')}</p>}
                        {feedback.points_a_developper?.length > 0 && <p className="text-xs text-tw-muted">À développer : {feedback.points_a_developper.join(' · ')}</p>}
                        <p className="text-[11px] text-tw-muted">Méthode : {feedback.methode}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
