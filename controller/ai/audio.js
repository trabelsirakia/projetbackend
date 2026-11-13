/**
 * Décodage audio côté serveur, sans ffmpeg : le navigateur enregistre la réponse (MediaRecorder), la décode
 * (Web Audio) et l'envoie en WAV PCM 16 bits mono 16 kHz. Ici : lecture de l'en-tête RIFF, conversion en Float32,
 * mélange des canaux et rééchantillonnage linéaire vers 16 kHz si besoin (Whisper attend du 16 kHz mono).
 */
const AppError = require('../../config/utils/AppError');

const TARGET_RATE = 16000;

function decodeWav(buffer) {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new AppError('Audio invalide : un fichier WAV (PCM) est attendu.', 422, 'AUDIO_INVALID');
  }
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = { format: buffer.readUInt16LE(body), channels: buffer.readUInt16LE(body + 2), rate: buffer.readUInt32LE(body + 4), bits: buffer.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      data = buffer.subarray(body, Math.min(buffer.length, body + size));
    }
    offset = body + size + (size % 2);
  }
  if (!fmt || !data) throw new AppError('Audio WAV incomplet.', 422, 'AUDIO_INVALID');
  if (!((fmt.format === 1 && fmt.bits === 16) || (fmt.format === 3 && fmt.bits === 32))) {
    throw new AppError('Audio WAV non pris en charge (PCM 16 bits ou float 32 bits attendu).', 422, 'AUDIO_INVALID');
  }
  const bytes = fmt.bits / 8;
  const frames = Math.floor(data.length / (bytes * fmt.channels));
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c += 1) {
      const at = (i * fmt.channels + c) * bytes;
      sum += fmt.format === 1 ? data.readInt16LE(at) / 32768 : data.readFloatLE(at);
    }
    mono[i] = sum / fmt.channels;
  }
  const samples = fmt.rate === TARGET_RATE ? mono : resample(mono, fmt.rate, TARGET_RATE);
  return { samples, durationSec: samples.length / TARGET_RATE };
}

function resample(input, from, to) {
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i += 1) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    out[i] = input[i0] + (input[i1] - input[i0]) * (pos - i0);
  }
  return out;
}

/** Énergie moyenne (RMS) : sert à détecter une réponse silencieuse avant d'appeler Whisper. */
function rms(samples) {
  let s = 0;
  for (let i = 0; i < samples.length; i += 1) s += samples[i] * samples[i];
  return Math.sqrt(s / Math.max(1, samples.length));
}

/** WAV PCM 16 bits mono à partir d'échantillons Float32 (tests et collection Postman). */
function encodeWav(samples, rate = TARGET_RATE) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i += 1) buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return buffer;
}

module.exports = { decodeWav, rms, encodeWav, TARGET_RATE };
