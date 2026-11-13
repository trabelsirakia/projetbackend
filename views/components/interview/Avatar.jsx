import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

/**
 * Avatar de l'intervieweuse « Nora » (SVG animé, aucun fichier externe).
 *  - speaking  : la bouche s'ouvre au rythme de la parole (amplitude pseudo-aléatoire lissée + impulsions
 *                sur chaque mot prononcé, transmises par `pulse` depuis la synthèse vocale) ;
 *  - listening : léger hochement de tête, halo vert ;
 *  - thinking  : regard vers le haut, points de suspension.
 * Clignement des yeux naturel (intervalle aléatoire), respiration (léger mouvement des épaules).
 */
export default function Avatar({ state = 'idle', pulse = 0, name = 'Nora', className }) {
  const [mouth, setMouth] = useState(0);
  const [blink, setBlink] = useState(false);
  const target = useRef(0);
  const lastPulse = useRef(pulse);

  // Ouverture de la bouche : interpolation douce vers une cible qui change pendant la parole.
  useEffect(() => {
    let raf;
    let t = 0;
    const tick = () => {
      t += 1;
      if (state === 'speaking') {
        if (t % 6 === 0) target.current = 0.25 + Math.random() * 0.75;
      } else target.current = 0;
      // Pas de nouveau rendu quand la bouche est immobile (même valeur renvoyée : React ignore la mise à jour).
      setMouth((m) => { const n = m + (target.current - m) * 0.35; return Math.abs(n - m) < 0.002 ? m : n; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  // Chaque mot prononcé (événement « boundary » de la synthèse vocale) ouvre franchement la bouche.
  useEffect(() => {
    if (pulse !== lastPulse.current) {
      lastPulse.current = pulse;
      target.current = 1;
    }
  }, [pulse]);

  useEffect(() => {
    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        schedule();
      }, 2200 + Math.random() * 3000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const eyeRy = blink ? 0.6 : state === 'thinking' ? 5.5 : 6.5;
  const eyeY = state === 'thinking' ? 133 : 136;
  const mouthRy = 2 + mouth * 9;

  return (
    <div className={clsx('relative', className)}>
      <svg viewBox="0 0 320 320" className="h-full w-full" role="img" aria-label={`${name}, intervieweuse virtuelle, ${state === 'speaking' ? 'parle' : state === 'listening' ? 'vous écoute' : 'attend'}`}>
        <defs>
          <radialGradient id="av-bg" cx="50%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#21416B" />
            <stop offset="100%" stopColor="#0B1828" />
          </radialGradient>
          <linearGradient id="av-skin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E9B98F" />
            <stop offset="100%" stopColor="#D9A276" />
          </linearGradient>
          <linearGradient id="av-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3A2418" />
            <stop offset="100%" stopColor="#24150D" />
          </linearGradient>
          <linearGradient id="av-blazer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D5FAE" />
            <stop offset="100%" stopColor="#123E75" />
          </linearGradient>
        </defs>
        <rect width="320" height="320" fill="url(#av-bg)" />
        {/* Vagues TalentWave en fond */}
        <g fill="none" stroke="#7DB8FF" strokeOpacity="0.12" strokeWidth="2">
          <path d="M0 260 C 60 235 110 285 170 258 S 270 230 320 250" />
          <path d="M0 280 C 60 255 110 305 170 278 S 270 250 320 270" />
        </g>

        <g className={clsx(state === 'listening' && 'avatar-nod', 'avatar-breathe')} style={{ transformOrigin: '160px 300px' }}>
          {/* Épaules et veste */}
          <path d="M58 320 C 64 262 104 238 160 236 C 216 238 256 262 262 320 Z" fill="url(#av-blazer)" />
          <path d="M136 238 L160 282 L184 238 Z" fill="#F3F5F8" />
          <path d="M128 240 L160 300 L148 240 Z" fill="#0F2238" opacity="0.35" />
          <path d="M192 240 L160 300 L172 240 Z" fill="#0F2238" opacity="0.35" />
          {/* Cou */}
          <path d="M142 200 L142 242 Q160 252 178 242 L178 200 Z" fill="#D49A6E" />
          {/* Cheveux arrière */}
          <path d="M92 150 C 86 80 120 52 162 52 C 206 52 238 84 230 150 C 232 190 226 214 214 232 L106 232 C 94 214 88 190 92 150 Z" fill="url(#av-hair)" />
          {/* Visage */}
          <ellipse cx="160" cy="146" rx="56" ry="66" fill="url(#av-skin)" />
          {/* Oreilles */}
          <ellipse cx="104" cy="148" rx="7" ry="12" fill="#D9A276" />
          <ellipse cx="216" cy="148" rx="7" ry="12" fill="#D9A276" />
          {/* Frange */}
          <path d="M104 128 C 108 82 140 70 168 74 C 196 78 216 96 218 128 C 196 104 168 96 140 102 C 124 106 112 116 104 128 Z" fill="url(#av-hair)" />
          {/* Sourcils */}
          <path d={state === 'thinking' ? 'M126 116 Q138 108 150 114' : 'M126 120 Q138 113 150 118'} stroke="#2B1A10" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d={state === 'thinking' ? 'M170 114 Q182 108 194 116' : 'M170 118 Q182 113 194 120'} stroke="#2B1A10" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          {/* Yeux */}
          <ellipse cx="138" cy={eyeY} rx="7.5" ry={eyeRy} fill="#FFFFFF" />
          <ellipse cx="182" cy={eyeY} rx="7.5" ry={eyeRy} fill="#FFFFFF" />
          {!blink && <circle cx="138" cy={eyeY + (state === 'thinking' ? -1.5 : 0.5)} r="4" fill="#3B2A1E" />}
          {!blink && <circle cx="182" cy={eyeY + (state === 'thinking' ? -1.5 : 0.5)} r="4" fill="#3B2A1E" />}
          {!blink && <circle cx="139.5" cy={eyeY - 1.5} r="1.3" fill="#FFFFFF" />}
          {!blink && <circle cx="183.5" cy={eyeY - 1.5} r="1.3" fill="#FFFFFF" />}
          {/* Nez */}
          <path d="M160 142 Q156 160 162 164" stroke="#B9835B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Joues */}
          <ellipse cx="124" cy="166" rx="10" ry="6" fill="#E58F7B" opacity="0.28" />
          <ellipse cx="196" cy="166" rx="10" ry="6" fill="#E58F7B" opacity="0.28" />
          {/* Bouche */}
          {mouth > 0.06 ? (
            <g>
              <ellipse cx="160" cy="184" rx={13 + mouth * 3} ry={mouthRy} fill="#7A2E2E" />
              <ellipse cx="160" cy={184 + mouthRy * 0.55} rx={8} ry={Math.max(1, mouthRy * 0.35)} fill="#C45B5B" />
            </g>
          ) : (
            <path d="M146 182 Q160 192 174 182" stroke="#9C4A44" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          )}
          {/* Boucles d'oreilles */}
          <circle cx="104" cy="164" r="2.5" fill="#E7C66B" />
          <circle cx="216" cy="164" r="2.5" fill="#E7C66B" />
        </g>
      </svg>
      {state === 'thinking' && (
        <div className="absolute right-6 top-6 flex gap-1 rounded-full bg-black/40 px-3 py-2" aria-hidden>
          {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-white" style={{ animationDelay: `${i * 120}ms` }} />)}
        </div>
      )}
    </div>
  );
}
