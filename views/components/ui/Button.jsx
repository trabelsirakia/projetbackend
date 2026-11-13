import clsx from 'clsx';
import Spinner from './Spinner';

const VARIANTS = {
  primary: 'bg-tw-primary text-white hover:bg-tw-primary-strong active:bg-tw-primary-strong',
  secondary: 'bg-tw-surface text-tw-ink border border-tw-line hover:border-tw-ink/25 hover:bg-tw-canvas',
  ghost: 'text-tw-accent hover:bg-tw-tint',
  danger: 'bg-tw-danger-fill text-white hover:brightness-95',
  success: 'bg-tw-success-fill text-white hover:brightness-95',
};

const SIZES = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
};

export default function Button({
  children, variant = 'primary', size = 'md', loading = false, icon: Icon, className, disabled, type = 'button', ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </button>
  );
}
