import Logo from './Logo';
import Spinner from './Spinner';

export default function FullPageLoader({ label = 'Chargement…' }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-tw-canvas" role="status">
      <Logo />
      <div className="flex items-center gap-2 text-sm text-tw-muted">
        <Spinner className="size-4 text-tw-accent" />
        {label}
      </div>
    </div>
  );
}
