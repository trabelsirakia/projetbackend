import clsx from 'clsx';
import { motion } from 'motion/react';
import { Search } from 'lucide-react';
import { scoreBar, scoreTone } from '../utils/labels';

/** Pastille de statut à partir d'une table de libellés (utils/labels.js). */
export function Pill({ meta, value }) {
  const m = meta[value] || { label: value || '—', cls: 'border border-tw-line text-tw-muted' };
  return <span className={clsx('inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium', m.cls)}>{m.label}</span>;
}

/** Barre de score 0-100 animée. */
export function ScoreBar({ label, value, hint }) {
  return (
    <div className="flex items-center gap-3 py-2.5 text-sm">
      <span className="flex-1 text-tw-muted" title={hint}>{label}</span>
      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-tw-canvas sm:w-36">
        <motion.span className={clsx('block h-full rounded-full', scoreBar(value))} initial={{ width: 0 }} animate={{ width: `${value ?? 0}%` }} transition={{ duration: 0.7 }} />
      </span>
      <span className={clsx('w-9 text-right font-semibold tabular', scoreTone(value))}>{value ?? '—'}</span>
    </div>
  );
}

/** Grand score circulaire. */
export function ScoreRing({ value = 0, size = 120, label }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth="8" fill="none" stroke="var(--color-tw-line)" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth="8" fill="none" strokeLinecap="round"
          stroke={value >= 70 ? 'var(--color-tw-success)' : value >= 50 ? 'var(--color-tw-warning)' : 'var(--color-tw-danger)'}
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1 }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-bold tabular">{value}</p>
        {label && <p className="text-[11px] text-tw-muted">{label}</p>}
      </div>
    </div>
  );
}

/** Explication du job matching (même présentation que la page d'accueil). */
export function MatchingCard({ matching, title }) {
  if (!matching) return null;
  const b = matching.breakdown || {};
  return (
    <div className="card overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-tw-line p-5">
        <div>
          <p className="eyebrow">Correspondance avec l'offre</p>
          {title && <p className="mt-1.5 font-semibold">{title}</p>}
        </div>
        <p className="shrink-0 text-tw-accent"><span className="text-3xl font-bold tabular">{matching.score}</span><span className="text-tw-muted">/100</span></p>
      </div>
      <div className="divide-y divide-tw-line px-5">
        <ScoreBar label="Compétences demandées (45 %)" value={b.skills} />
        <ScoreBar label="Proximité du parcours (25 %)" value={b.semantic} hint="Similarité sémantique CV ↔ description du poste" />
        <ScoreBar label="Expérience (20 %)" value={b.experience} />
        <ScoreBar label="Langues (10 %)" value={b.languages} />
      </div>
      <div className="border-t border-tw-line bg-tw-canvas px-5 py-4">
        <p className="eyebrow">Pourquoi ce score</p>
        <div className="mt-2 space-y-1 text-sm leading-relaxed">{(matching.explanation || []).map((e) => <p key={e}>{e}</p>)}</div>
        {matching.matchedSkills?.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-tw-accent">Preuves trouvées dans le CV ({matching.matchedSkills.length})</summary>
            <ul className="mt-2 space-y-1.5">
              {matching.matchedSkills.map((m) => (
                <li key={m.skill} className="text-tw-muted"><strong className="text-tw-ink">{m.skill}</strong> {m.similarity < 1 ? `(sens proche, ${Math.round(m.similarity * 100)} %)` : ''} — « {m.evidence} »</li>
              ))}
            </ul>
          </details>
        )}
        <p className="mt-3 text-[11px] text-tw-muted">Méthode : {matching.method}</p>
      </div>
    </div>
  );
}

/** Barre de recherche + filtres (liste CRUD). */
export function Toolbar({ search, onSearch, placeholder = 'Rechercher…', children }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <label className="relative flex-1">
        <span className="sr-only">Rechercher</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-tw-muted" aria-hidden />
        <input
          value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-tw-line bg-tw-surface pl-10 pr-3 text-sm focus:border-tw-accent focus:outline-none focus:ring-3 focus:ring-tw-accent/15"
        />
      </label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Petit sélecteur compact pour les filtres. */
export function FilterSelect({ value, onChange, options, label }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-lg border border-tw-line bg-tw-surface px-3 text-sm text-tw-ink focus:border-tw-accent focus:outline-none">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** En-tête de colonne triable : clic = croissant, re-clic = décroissant. */
export function SortHeader({ field, sort, onSort, children, className }) {
  const active = sort.replace('-', '') === field;
  const desc = sort.startsWith('-');
  return (
    <th scope="col" className={clsx('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-tw-muted', className)} aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" onClick={() => onSort(active && !desc ? `-${field}` : field)} className="inline-flex items-center gap-1 hover:text-tw-ink">
        {children}<span className={clsx('text-[10px]', active ? 'text-tw-accent' : 'opacity-30')}>{active && desc ? '▼' : '▲'}</span>
      </button>
    </th>
  );
}
