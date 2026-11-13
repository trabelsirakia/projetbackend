import { useId, useState } from 'react';
import clsx from 'clsx';
import { BarChart3, Table2 } from 'lucide-react';

/**
 * Couleurs des graphiques : variables CSS définies dans index.css pour chaque thème, validées avec le contrôleur
 * de palette (bande de luminosité, daltonisme, contraste avec le fond de la carte) :
 *  - série unique et rôles : bleu, ocre, violet (clair : #2b6cb0 / #b8781f / #7a5aa8 ; sombre : #3f82d0 / #c4842f /
 *    #9373c6) : tous les contrôles passent dans les deux thèmes (contraste ≥ 3:1, daltonisme ΔE ≥ 22) ;
 *  - statuts réservés : vert = actif, rouge = expiré, gris neutre = désactivé (le gris ne « passe » pas le seuil
 *    de saturation par construction ; il est toujours accompagné de sa légende chiffrée et du tableau).
 */
const v = (name) => `var(--chart-${name})`;
export const CHART = {
  series: v('series'),
  roles: { candidat: v('candidat'), rh: v('rh'), admin: v('admin') },
  deemphasis: v('deemphasis'),
  status: { active: v('active'), inactive: v('inactive'), expired: v('expired') },
  grid: v('grid'),
  axis: v('axis'),
  cursor: v('cursor'),
  tick: 'var(--color-tw-muted)',
  surface: 'var(--color-tw-surface)',
};

export const axisProps = {
  tick: { fill: CHART.tick, fontSize: 12 },
  axisLine: { stroke: CHART.axis },
  tickLine: false,
};

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
export const fmt = (n) => (Math.abs(n) >= 1000 ? compact.format(n) : new Intl.NumberFormat('fr-FR').format(n));
// Pourcentage à la française : « 2,8 % ».
export const fmtPct = (n) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n)} %`;

// Graduations « rondes » (pas de 1, 2 ou 5 × 10^n) de 0 jusqu'au-dessus du maximum.
export function niceTicks(max, target = 4) {
  if (!max || max <= 0) return [0, 1];
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  // Données de comptage : pas entier, au moins 1.
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) || 10 * pow);
  const ticks = [];
  for (let v = 0; v < max + step; v += step) ticks.push(Math.round(v));
  return ticks;
}

// Infobulle : la valeur d'abord (forte), le libellé ensuite ; clé en trait de la couleur de la série.
export function ChartTooltip({ active, payload, label, unit = '', labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-tw-line bg-tw-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 text-tw-muted">{labelFormatter ? labelFormatter(label, payload) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey || p.name} className="flex items-center gap-2">
          <span className="h-0.5 w-3 rounded-full" style={{ background: p.color || p.payload?.fill }} aria-hidden />
          <strong className="text-sm text-tw-ink">{fmt(p.value)}{unit}</strong>
          <span className="text-tw-muted">{p.name}</span>
        </p>
      ))}
    </div>
  );
}

// Légende : pastille de la forme de la marque (barre/aire = carré, ligne = trait), texte en encre normale.
export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tw-ink/80">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={clsx('shrink-0', i.shape === 'line' ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-[3px]')} style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Carte de graphique : titre, sous-titre, légende, et bascule vers une vue tableau
 * (chaque valeur reste lisible sans survol ni couleur).
 */
export function ChartCard({ title, subtitle, legend, table, children, className, empty }) {
  const [view, setView] = useState('chart');
  const id = useId();
  return (
    <section className={clsx('card flex flex-col p-5', className)} aria-labelledby={id}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-tw-muted">{subtitle}</p>}
        </div>
        {table && !empty && (
          <div className="flex shrink-0 rounded-xl border border-tw-line p-0.5" role="group" aria-label="Affichage">
            {[['chart', BarChart3, 'Graphique'], ['table', Table2, 'Tableau']].map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={clsx('grid size-8 place-items-center rounded-lg transition-colors duration-200', view === v ? 'bg-tw-tint text-tw-accent' : 'text-tw-muted hover:text-tw-accent')}
                title={label}
                aria-label={label}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        )}
      </header>
      {empty ? (
        <p className="grid flex-1 place-items-center py-10 text-sm text-tw-muted">{empty}</p>
      ) : view === 'table' ? (
        <div className="overflow-x-auto">{table}</div>
      ) : (
        <>
          {legend && <div className="mb-3">{legend}</div>}
          <div className="flex-1">{children}</div>
        </>
      )}
    </section>
  );
}

export function DataTable({ columns, rows }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs uppercase tracking-wide text-tw-muted">
        <tr>{columns.map((c) => <th key={c.key} scope="col" className={clsx('border-b border-tw-line py-2 font-semibold', c.align === 'right' && 'text-right')}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.key ?? i} className="border-b border-tw-line/60 last:border-0">
            {columns.map((c) => (
              <td key={c.key} className={clsx('py-2', c.align === 'right' && 'text-right tabular-nums')}>{c.format ? c.format(r[c.key], r) : r[c.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Tuile de chiffre clé (chiffres proportionnels : pas de tabular-nums sur un grand nombre).
export function StatTile({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className="card min-w-0 px-5 py-4" data-tone={tone}>
      <p className="flex items-center gap-1.5 text-[13px] text-tw-muted"><Icon className="size-3.5" strokeWidth={1.75} aria-hidden />{label}</p>
      <p className="tabular mt-1.5 text-2xl font-semibold leading-tight text-tw-ink">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-tw-muted">{hint}</p>}
    </div>
  );
}
