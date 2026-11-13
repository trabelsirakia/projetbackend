import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-7xl font-bold text-tw-accent">404</p>
      <h1 className="mt-4 text-2xl font-semibold">Page introuvable</h1>
      <p className="mt-2 text-tw-muted">Le lien est peut-être incomplet ou la page a été déplacée.</p>
      <Link to="/" className="mt-6 rounded-lg bg-tw-primary px-5 py-2.5 text-sm font-medium text-white">Retour à l'accueil</Link>
    </div>
  );
}
