import { forwardRef, useId } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

// Liste déroulante native (accessible et fiable sur mobile) au style TalentWave.
const SelectField = forwardRef(function SelectField({ label, error, options, className, compact = false, ...rest }, ref) {
  const id = useId();
  return (
    <div className={clsx('space-y-1.5', className)}>
      {label && <label htmlFor={id} className={clsx('block font-medium', compact ? 'text-xs text-tw-muted' : 'text-sm')}>{label}</label>}
      <div className="relative">
        <select
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          className={clsx(
            'w-full appearance-none rounded-lg border bg-tw-surface text-tw-ink transition-colors duration-150',
            'focus:border-tw-accent focus:outline-none focus:ring-3 focus:ring-tw-accent/15',
            compact ? 'h-9 pl-3 pr-8 text-[13px]' : 'h-11 pl-3.5 pr-10 text-sm',
            error ? 'border-tw-danger' : 'border-tw-line hover:border-tw-ink/25',
          )}
          {...rest}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-tw-muted" aria-hidden />
      </div>
      {error && <p className="text-xs font-medium text-tw-danger">{error}</p>}
    </div>
  );
});

export default SelectField;
