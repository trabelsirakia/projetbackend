import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  BarChart3, Briefcase, ClipboardList, FileText, LogOut, Menu, UserCircle, Users as UsersIcon, Video, X,
} from 'lucide-react';
import Logo from '../components/ui/Logo';
import ThemeToggle from '../components/ui/ThemeToggle';
import Button from '../components/ui/Button';
import { Avatar, RoleBadge } from '../components/ui/Badges';
import ChatWidget from '../components/chat/ChatWidget';
import useAuth from '../hooks/useAuth';
import { homeFor } from '../routes/guards';

const LINKS = {
  anonymous: [{ to: '/offres', label: 'Offres' }, { to: '/#comment', label: 'Comment ça marche', hash: true }],
  candidat: [{ to: '/offres', label: 'Offres', icon: Briefcase }, { to: '/mes-candidatures', label: 'Mes candidatures', icon: FileText }],
  recruteur: [
    { to: '/recruteur', label: 'Tableau de bord', icon: BarChart3, end: true },
    { to: '/recruteur/offres', label: 'Offres', icon: Briefcase },
    { to: '/recruteur/candidatures', label: 'Candidatures', icon: FileText },
    { to: '/recruteur/quiz', label: 'Quiz', icon: ClipboardList },
    { to: '/recruteur/entretiens', label: 'Entretiens', icon: Video },
  ],
};
LINKS.admin = [...LINKS.recruteur, { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: UsersIcon }];

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 hover:bg-tw-canvas" aria-haspopup="menu" aria-expanded={open} aria-label="Menu du compte">
        <Avatar firstName={user.firstName} lastName={user.lastName} size="sm" />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 top-12 z-50 w-64 animate-fade-in p-2 shadow-[var(--shadow-lift)]">
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold">{user.firstName} {user.lastName}</p>
            <p className="truncate text-xs text-tw-muted">{user.email}</p>
            <div className="mt-2"><RoleBadge role={user.role} /></div>
          </div>
          <div className="my-1 h-px bg-tw-line" />
          <Link to="/profil" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-tw-canvas" role="menuitem"><UserCircle className="size-4" />Mon profil</Link>
          <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-tw-danger hover:bg-tw-danger-soft" role="menuitem"><LogOut className="size-4" />Se déconnecter</button>
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = LINKS[user?.role] || LINKS.anonymous;
  // Salle d'entretien : plein écran, sans distraction.
  const immersive = /^\/entretien\//.test(location.pathname);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-tw-primary focus:px-3 focus:py-2 focus:text-white">Aller au contenu</a>
      {!immersive && (
        <header className="sticky top-0 z-40 border-b border-tw-line bg-tw-surface/90 backdrop-blur supports-[backdrop-filter]:bg-tw-surface/75">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
            <Link to={user ? homeFor(user) : '/'} aria-label="Accueil TalentWave Live"><Logo /></Link>
            <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
              {links.map((l) => (l.hash
                ? <a key={l.to} href={l.to} className="rounded-md px-3 py-2 text-sm text-tw-muted hover:text-tw-ink">{l.label}</a>
                : (
                  <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => clsx('rounded-md px-3 py-2 text-sm transition-colors', isActive ? 'bg-tw-tint font-medium text-tw-accent' : 'text-tw-muted hover:text-tw-ink')}>
                    {l.label}
                  </NavLink>
                )))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              {status === 'authenticated' ? (
                <UserMenu user={user} onLogout={onLogout} />
              ) : status === 'anonymous' && (
                <>
                  <Link to="/login" className="hidden rounded-md px-3 py-2 text-sm text-tw-muted hover:text-tw-ink sm:block">Connexion</Link>
                  <Button size="md" onClick={() => navigate('/inscription')}>Mon espace</Button>
                </>
              )}
              <button type="button" className="grid size-9 place-items-center rounded-lg border border-tw-line lg:hidden" onClick={() => setMobileOpen((o) => !o)} aria-label="Menu" aria-expanded={mobileOpen}>
                {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
            </div>
          </div>
          {mobileOpen && (
            <nav className="border-t border-tw-line bg-tw-surface px-4 py-3 lg:hidden" aria-label="Navigation mobile">
              {links.map((l) => (
                <Link key={l.to} to={l.to} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-tw-canvas">
                  {l.icon && <l.icon className="size-4 text-tw-muted" />}{l.label}
                </Link>
              ))}
              {status === 'anonymous' && <Link to="/login" className="block rounded-md px-3 py-2.5 text-sm hover:bg-tw-canvas">Connexion</Link>}
            </nav>
          )}
        </header>
      )}
      <main id="contenu" className="flex-1">
        <Outlet />
      </main>
      {!immersive && (
        <footer className="border-t border-tw-line bg-tw-surface">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-tw-muted sm:flex-row sm:px-6">
            <span>© {new Date().getFullYear()} TalentWave Live · Équipe DataWave · ESPRIT</span>
            <span>IA locale : Whisper · MiniLM · Llama 3.1 — vos données restent sur nos serveurs.</span>
          </div>
        </footer>
      )}
      {user?.role === 'candidat' && !immersive && <ChatWidget />}
    </div>
  );
}
