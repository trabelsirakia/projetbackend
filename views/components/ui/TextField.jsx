import { forwardRef, useId, useState } from 'react';
import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Champ de formulaire compatible React Hook Form (register).
 * type="password" ajoute le bouton œil afficher / masquer.
 */
const TextField = forwardRef(function TextField(
  { label, error, hint, icon: Icon, type = 'text', className, ...rest },
  ref,
) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={clsx('space-y-1.5', className)}>
      {label && <label htmlFor={id} className="block text-sm font-medium text-tw-ink">{label}</label>}
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-tw-muted" aria-hidden />}
        <input
          id={id}
          ref={ref}
          type={isPassword && visible ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={clsx(
            'h-11 w-full rounded-lg border bg-tw-surface text-sm text-tw-ink placeholder:text-tw-muted/60 transition-colors duration-150',
            'focus:border-tw-accent focus:outline-none focus:ring-3 focus:ring-tw-accent/15',
            Icon ? 'pl-10' : 'pl-3.5',
            isPassword ? 'pr-12' : 'pr-4',
            error ? 'border-tw-danger' : 'border-tw-line hover:border-tw-ink/25',
          )}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-tw-muted hover:bg-tw-canvas hover:text-tw-ink"
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-tw-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-tw-muted">{hint}</p>
      ) : null}
    </div>
  );
});

export default TextField;
