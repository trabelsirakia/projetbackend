import clsx from 'clsx';
import { AlertTriangle, Ban, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import Button from './Button';

const TONES = {
  error: { icon: AlertTriangle, cls: 'border-tw-danger-line bg-tw-danger-soft text-tw-danger' },
  blocked: { icon: Ban, cls: 'border-tw-danger-line bg-tw-danger-soft text-tw-danger' },
  success: { icon: CheckCircle2, cls: 'border-tw-success-line bg-tw-success-soft text-tw-success' },
  info: { icon: Info, cls: 'border-tw-line bg-tw-canvas text-tw-ink' },
  warning: { icon: AlertTriangle, cls: 'border-tw-warning-line bg-tw-warning-soft text-tw-warning' },
};

// Bandeau de message dans un formulaire.
export function Alert({ tone = 'info', title, children, className }) {
  const { icon: Icon, cls } = TONES[tone];
  return (
    <div role={tone === 'error' || tone === 'blocked' ? 'alert' : 'status'} className={clsx('flex gap-3 rounded-lg border p-3.5 text-sm animate-fade-in', cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-tw-ink/80">{children}</div>}
      </div>
    </div>
  );
}

// État vide illustré.
export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <svg viewBox="0 0 120 90" className="h-24 w-32" aria-hidden>
        <rect x="18" y="12" width="84" height="66" rx="10" fill="var(--color-tw-tint)" />
        <rect x="32" y="24" width="56" height="42" rx="6" fill="var(--color-tw-surface)" stroke="var(--color-tw-ink)" strokeWidth="1.5" />
        <path d="M42 38h36M42 47h24M42 56h14" stroke="var(--color-tw-accent)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-tw-muted">{description}</p>}
      {action}
    </div>
  );
}

// État d'erreur avec bouton « Réessayer ».
export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
      <div className="grid size-11 place-items-center rounded-lg bg-tw-danger-soft text-tw-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">Impossible de charger les données</h3>
      <p className="max-w-sm text-sm text-tw-muted">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>Réessayer</Button>}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={clsx('skeleton', className)} aria-hidden />;
}
