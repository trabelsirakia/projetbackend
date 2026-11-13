import clsx from 'clsx';

export default function Logo({ light = false, compact = false, className }) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <img src="/favicon.svg" alt="" className="size-8 shrink-0" />
      {!compact && (
        <span className={clsx('font-display text-[17px] font-semibold tracking-[-0.02em]', light ? 'text-white' : 'text-tw-ink')}>
          TalentWave <span className={light ? 'font-normal text-white/70' : 'font-normal text-tw-muted'}>Live</span>
        </span>
      )}
    </span>
  );
}
