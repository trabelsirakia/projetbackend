import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import useTheme from '../../hooks/useTheme';

const OPTIONS = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'system', label: 'Système', icon: Monitor },
];

/**
 * Choix du thème (clair, sombre, système), disponible sur toutes les pages.
 * Le bouton montre le thème affiché ; le menu se ferme au clic extérieur et avec Échap.
 */
export default function ThemeToggle({ className }) {
  const { preference, resolved, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const Icon = resolved === 'dark' ? Moon : Sun;
  const current = OPTIONS.find((o) => o.value === preference);

  return (
    // « relative » sert d'ancre au menu, sauf si la page positionne déjà le bouton (absolute / fixed).
    <div className={clsx(!/\b(absolute|fixed)\b/.test(className || '') && 'relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid size-9 place-items-center rounded-lg border border-tw-line bg-tw-surface text-tw-muted transition-colors hover:border-tw-accent/40 hover:text-tw-ink"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Thème : ${current.label.toLowerCase()} (changer)`}
        title={`Thème : ${current.label.toLowerCase()}`}
      >
        <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Thème" className="card absolute right-0 top-11 z-50 w-44 animate-fade-in p-1 shadow-[var(--shadow-lift)]">
          {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={preference === value}
              onClick={() => { setPreference(value); setOpen(false); }}
              className={clsx('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-tw-canvas',
                preference === value ? 'font-medium text-tw-ink' : 'text-tw-muted')}
            >
              <OptionIcon className="size-4" aria-hidden />
              <span className="flex-1 text-left">{label}</span>
              {preference === value && <Check className="size-4 text-tw-accent" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
