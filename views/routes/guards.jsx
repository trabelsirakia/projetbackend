import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import FullPageLoader from '../components/ui/FullPageLoader';

export const homeFor = (user) => (user?.role === 'candidat' ? '/mes-candidatures' : user?.role === 'admin' ? '/admin/utilisateurs' : '/recruteur');

// Pages réservées aux utilisateurs connectés.
export function PrivateRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

// Pages réservées à certains rôles (à placer sous PrivateRoute).
export function RoleRoute({ roles }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

// Login / signup : inutile d'y accéder si on est déjà connecté.
export function PublicOnlyRoute() {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}
