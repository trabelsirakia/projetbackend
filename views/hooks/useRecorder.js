import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Capture du micro en PCM brut (Web Audio), sans MediaRecorder : on obtient directement les échantillons,
 * rééchantillonnés à 16 kHz mono et encodés en WAV 16 bits dans le navigateur — exactement le format attendu
 * par Whisper côté serveur (aucun ffmpeg nécessaire).
 *
 * Détection d'activité vocale (VAD) par énergie RMS avec seuil adaptatif au bruit de fond :
 *  - `level` (0-1) pour le vumètre ;
 *  - arrêt automatique après `silenceMs` de silence une fois que la personne a parlé ;
 *  - arrêt automatique à `maxMs`.
 */
const TARGET_RATE = 16000;

function downsample(buffer, from) {
  if (from === TARGET_RATE) return buffer;
  const ratio = from / TARGET_RATE;
  const out = new Float32Array(Math.floor(buffer.length / ratio));
  for (let i = 0; i < out.length; i += 1) {
    // Moyenne de la fenêtre (filtre passe-bas simple, évite le repliement).
    const start = Math.floor(i * ratio);
    const end = Math.min(buffer.length, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = start; j < end; j += 1) s += buffer[j];
    out[i] = s / Math.max(1, end - start);
  }
  return out;
}

export function encodeWav(samples, rate = TARGET_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i += 1) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export default function useRecorder(stream) {
  const [level, setLevel] = useState(0);
  const [recording, setRecording] = useState(false);
  const [spoke, setSpoke] = useState(false);
  const ctxRef = useRef(null);
  const nodeRef = useRef(null);
  const chunks = useRef([]);
  const state = useRef({ active: false, startedAt: 0, lastVoice: 0, spoke: false, noise: 0.01, resolve: null, opts: {} });

  // Graphe audio permanent (vumètre même hors enregistrement) tant que le flux existe.
  useEffect(() => {
    if (!stream || !stream.getAudioTracks().length) return undefined;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    nodeRef.current = node;
    node.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      setLevel(Math.min(1, rms * 8));
      const s = state.current;
      if (!s.active) {
        s.noise = s.noise * 0.95 + rms * 0.05; // bruit de fond estimé hors enregistrement
        return;
      }
      chunks.current.push(new Float32Array(data));
      const now = performance.now();
      const threshold = Math.max(0.012, s.noise * 2.5);
      if (rms > threshold) {
        s.lastVoice = now;
        if (!s.spoke) { s.spoke = true; setSpoke(true); }
      }
      const elapsed = now - s.startedAt;
      if (elapsed >= s.opts.maxMs || (s.spoke && now - s.lastVoice > s.opts.silenceMs && elapsed > 4000)) {
        s.active = false;
        s.resolve?.(elapsed >= s.opts.maxMs ? 'temps' : 'silence');
      }
    };
    source.connect(node);
    // Sortie muette : le nœud doit être relié à la destination pour être appelé, sans renvoyer le son.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    node.connect(mute);
    mute.connect(ctx.destination);
    return () => {
      node.disconnect();
      source.disconnect();
      ctx.close().catch(() => {});
    };
  }, [stream]);

  /** Démarre l'enregistrement ; la promesse se résout avec la raison de l'arrêt automatique ('silence' | 'temps'). */
  const start = useCallback(({ maxMs = 60000, silenceMs = 5000 } = {}) => {
    chunks.current = [];
    ctxRef.current?.resume?.();
    setSpoke(false);
    setRecording(true);
    return new Promise((resolve) => {
      Object.assign(state.current, { active: true, startedAt: performance.now(), lastVoice: performance.now(), spoke: false, resolve, opts: { maxMs, silenceMs } });
    });
  }, []);

  /** Arrête et renvoie { wav, durationSec, spoke }. */
  const stop = useCallback(() => {
    const s = state.current;
    s.active = false;
    s.resolve?.('manuel');
    setRecording(false);
    const rate = ctxRef.current?.sampleRate || 48000;
    const total = chunks.current.reduce((a, c) => a + c.length, 0);
    const all = new Float32Array(total);
    let o = 0;
    for (const c of chunks.current) { all.set(c, o); o += c.length; }
    chunks.current = [];
    const pcm = downsample(all, rate);
    return { wav: encodeWav(pcm), durationSec: pcm.length / TARGET_RATE, spoke: s.spoke };
  }, []);

  return { level, recording, spoke, start, stop, supported: Boolean(window.AudioContext || window.webkitAudioContext) };
}
