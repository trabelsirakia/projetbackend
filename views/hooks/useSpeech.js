import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Voix de l'avatar (synthèse vocale du navigateur, fr-FR / en-US) et sous-titres en direct du candidat
 * (reconnaissance vocale du navigateur, Chrome / Edge) — la transcription NOTÉE reste celle de Whisper côté serveur.
 */
function pickVoice(lang) {
  const voices = window.speechSynthesis?.getVoices() || [];
  const same = voices.filter((v) => v.lang?.toLowerCase().startsWith(lang));
  // Voix naturelles en priorité (Edge « Natural », Google), puis voix féminines connues.
  return same.find((v) => /natural|online/i.test(v.name))
    || same.find((v) => /google/i.test(v.name))
    || same.find((v) => /denise|hortense|julie|amélie|jenny|aria|zira|samantha/i.test(v.name))
    || same[0] || null;
}

export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false);
  const [pulse, setPulse] = useState(0);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!supported) return undefined;
    window.speechSynthesis.getVoices(); // déclenche le chargement des voix
    return () => window.speechSynthesis.cancel();
  }, [supported]);

  /** Prononce le texte ; résout à la fin (ou après une durée estimée si la synthèse est indisponible). */
  const speak = useCallback((text, lang = 'fr') => new Promise((resolve) => {
    const estimate = Math.min(20000, 1500 + text.split(/\s+/).length * 380);
    if (!supported) {
      setSpeaking(true);
      setTimeout(() => { setSpeaking(false); resolve(); }, estimate);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'en' ? 'en-US' : 'fr-FR';
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.rate = 1;
    u.pitch = 1.05;
    let done = false;
    let started = false;
    let fallback = false; // la synthèse a été annulée : on ignore ses événements « end » / « error »
    const timers = [];
    const finish = () => { if (done) return; done = true; timers.forEach(clearTimeout); setSpeaking(false); resolve(); };
    u.onstart = () => { started = true; setSpeaking(true); };
    u.onboundary = () => setPulse((p) => p + 1);
    u.onend = () => { if (!fallback) finish(); };
    u.onerror = () => { if (!fallback) finish(); };
    // Voix qui ne démarre pas (aucune voix installée, onglet en arrière-plan) : la question reste affichée
    // en sous-titre et on laisse un temps de lecture (≈ 4 mots/s) au lieu d'attendre indéfiniment.
    timers.push(setTimeout(() => {
      if (started || done) return;
      fallback = true;
      window.speechSynthesis.cancel();
      timers.push(setTimeout(finish, Math.min(12000, 1000 + text.split(/\s+/).length * 250)));
    }, 2000));
    // Filet de sécurité : certains navigateurs n'émettent jamais « end ».
    timers.push(setTimeout(finish, estimate + 6000));
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }), [supported]);

  const cancel = useCallback(() => { if (supported) window.speechSynthesis.cancel(); setSpeaking(false); }, [supported]);
  return { speak, cancel, speaking, pulse, supported };
}

export function useLiveCaptions(lang = 'fr') {
  const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const [text, setText] = useState('');
  const recRef = useRef(null);
  const finalRef = useRef('');
  const activeRef = useRef(false);

  const start = useCallback(() => {
    if (!Recognition) return;
    finalRef.current = '';
    setText('');
    const rec = new Recognition();
    rec.lang = lang === 'en' ? 'en-US' : 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        if (e.results[i].isFinal) finalRef.current += `${e.results[i][0].transcript} `;
        else interim += e.results[i][0].transcript;
      }
      setText(`${finalRef.current}${interim}`.trim());
    };
    rec.onend = () => { if (activeRef.current) { try { rec.start(); } catch { /* déjà relancée */ } } };
    rec.onerror = () => {};
    activeRef.current = true;
    try { rec.start(); } catch { /* indisponible */ }
    recRef.current = rec;
  }, [Recognition, lang]);

  const stop = useCallback(() => {
    activeRef.current = false;
    try { recRef.current?.stop(); } catch { /* déjà arrêtée */ }
    return finalRef.current.trim() || text;
  }, [text]);

  useEffect(() => () => { activeRef.current = false; try { recRef.current?.abort(); } catch { /* rien */ } }, []);
  return { text, start, stop, supported: Boolean(Recognition) };
}
