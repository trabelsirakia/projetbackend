import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Numéros visibles : 1 … 4 5 [6] 7 8 … 20
function pages(current, total) {
  const set = new Set([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => set.add(p));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((p) => set.add(p));
  const list = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  list.forEach((p, i) => {
    if (i && p - list[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export default function Pagination({ pagination, onPage, onLimit, limits = [10, 20, 50] }) {
  if (!pagination) return null;
  const { page, limit, total } = pagination;
  const totalPages = pagination.totalPages ?? pagination.pages ?? 1;
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, total);

  const btn = 'grid size-9 place-items-center rounded-md text-sm font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-col items-center justify-between gap-3 px-1 sm:flex-row">
      <div className="flex items-center gap-3 text-sm text-tw-muted">
        <span><strong className="text-tw-ink">{from}–{to}</strong> sur <strong className="text-tw-ink">{total}</strong></span>
        {onLimit && (
          <label className="flex items-center gap-1.5">
            <span className="sr-only">Éléments par page</span>
            <select value={limit} onChange={(e) => onLimit(Number(e.target.value))} className="h-8 rounded-md border border-tw-line bg-tw-surface px-2 text-xs">
              {limits.map((l) => <option key={l} value={l}>{l} / page</option>)}
            </select>
          </label>
        )}
      </div>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button type="button" className={clsx(btn, 'hover:bg-tw-tint')} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Page précédente">
          <ChevronLeft className="size-4" />
        </button>
        {pages(page, totalPages).map((p) => (typeof p === 'string'
          ? <span key={p} className="w-6 text-center text-tw-muted">…</span>
          : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={clsx(btn, p === page ? 'bg-tw-primary text-white' : 'hover:bg-tw-canvas')}
            >
              {p}
            </button>
          )))}
        <button type="button" className={clsx(btn, 'hover:bg-tw-tint')} onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Page suivante">
          <ChevronRight className="size-4" />
        </button>
      </nav>
    </div>
  );
}
