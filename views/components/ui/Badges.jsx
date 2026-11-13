import clsx from 'clsx';

export const ROLE_META = {
  admin: { label: 'Administrateur', cls: 'bg-tw-primary text-white' },
  recruteur: { label: 'Recruteur', cls: 'bg-tw-tint text-tw-accent' },
  candidat: { label: 'Candidat', cls: 'border border-tw-line bg-tw-surface text-tw-muted' },
};

export function Badge({ children, className }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium', className)}>
      {children}
    </span>
  );
}

export function RoleBadge({ role }) {
  const meta = ROLE_META[role] || ROLE_META.candidat;
  return <Badge className={meta.cls}>{meta.label}</Badge>;
}

export function StatusBadge({ blocked }) {
  return blocked
    ? <Badge className="bg-tw-danger-soft text-tw-danger"><span className="size-1.5 rounded-full bg-tw-danger" />Bloqué</Badge>
    : <Badge className="bg-tw-success-soft text-tw-success"><span className="size-1.5 rounded-full bg-tw-success" />Actif</Badge>;
}

// Jauge 0-100 : vert < 40, orange < 70, rouge ≥ 70 (suspect).
export function SuspicionGauge({ score = 0, threshold = 70 }) {
  const tone = score >= threshold ? 'bg-tw-danger' : score >= 40 ? 'bg-tw-warning' : 'bg-tw-success';
  const text = score >= threshold ? 'text-tw-danger' : score >= 40 ? 'text-tw-warning' : 'text-tw-success';
  const label = score >= threshold ? 'Suspect' : score >= 40 ? 'À surveiller' : 'Normal';
  return (
    <div className="flex min-w-24 items-center gap-2" title={`Score de suspicion : ${score}/100 (${label})`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-tw-canvas" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label="Score de suspicion">
        <div className={clsx('h-full rounded-full transition-all duration-200', tone)} style={{ width: `${Math.max(score, 3)}%` }} />
      </div>
      <span className={clsx('w-7 text-right text-xs font-semibold tabular-nums', text)}>{score}</span>
    </div>
  );
}

// Teintes sourdes, aucune couleur d'état (le rouge signifie « problème » ailleurs).
// Toutes assez foncées pour des initiales blanches (≥ 4,5:1), et distinctes du fond dans les deux thèmes.
const AVATAR_COLORS = ['bg-[#1D5FAE]', 'bg-[#1D7348]', 'bg-[#8A5A2B]', 'bg-[#4A5565]', 'bg-[#6B4FA0]'];

export function Avatar({ firstName = '', lastName = '', size = 'md' }) {
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '?';
  const index = (firstName.charCodeAt(0) + lastName.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return (
    <span
      className={clsx(
        'inline-grid shrink-0 place-items-center rounded-full font-medium text-white',
        AVATAR_COLORS[index],
        size === 'lg' ? 'size-16 text-xl' : size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm',
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
