import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import Button from './Button';

/**
 * Fenêtre modale accessible : Échap et clic extérieur ferment, le focus est placé dans la fenêtre
 * puis rendu à l'élément d'origine, le défilement de la page est bloqué.
 */
export default function Modal({ open, onClose, title, description, children, footer, size = 'md', busy = false }) {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const target = panelRef.current?.querySelector('input:not([disabled]), select, textarea, button:not([data-close])');
      (target || panelRef.current)?.focus();
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-[#0A1017]/45 backdrop-blur-[1px] animate-fade-in dark:bg-black/60" onClick={() => !busy && onClose()} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-xl border border-tw-line bg-tw-surface shadow-[var(--shadow-lift)] animate-fade-in sm:rounded-xl',
          size === 'lg' ? 'sm:max-w-3xl' : size === 'sm' ? 'sm:max-w-md' : 'sm:max-w-xl',
        )}
      >
        <header className="flex items-start gap-4 border-b border-tw-line px-6 pb-4 pt-5">
          <div className="flex-1">
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-tw-muted">{description}</p>}
          </div>
          <button type="button" data-close onClick={onClose} disabled={busy} className="grid size-9 place-items-center rounded-md text-tw-muted hover:bg-tw-canvas" aria-label="Fermer">
            <X className="size-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-tw-line px-6 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirmer', tone = 'danger', busy, icon }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      busy={busy}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button variant={tone} onClick={onConfirm} loading={busy} icon={icon}>{confirmLabel}</Button>
        </>
      )}
    >
      <div className="text-sm text-tw-ink/80">{children}</div>
    </Modal>
  );
}
