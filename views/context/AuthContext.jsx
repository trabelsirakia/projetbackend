import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './auth-context';
import toast from 'react-hot-toast';
import { authApi } from '../services/api';
import { onSessionLost, refreshSession, setAccessToken } from '../services/client';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  const startSession = useCallback(({ user: u, accessToken }) => {
    setAccessToken(accessToken);
    setUser(u);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  // Au chargement : on tente de restaurer la session grâce au cookie httpOnly.
  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .then((d) => { if (!cancelled) startSession(d); })
      .catch(() => { if (!cancelled) clearSession(); });
    return () => { cancelled = true; };
  }, [startSession, clearSession]);

  useEffect(() => {
    onSessionLost((reason) => {
      clearSession();
      if (reason === 'blocked') toast.error('Votre compte a été bloqué par un administrateur.', { id: 'session-lost' });
      else toast.error('Votre session a expiré, reconnectez-vous.', { id: 'session-lost' });
    });
  }, [clearSession]);

  const login = useCallback(async (credentials) => {
    const res = await authApi.login(credentials);
    startSession(res.data);
    return res.data.user;
  }, [startSession]);

  const signup = useCallback(async (payload) => {
    const res = await authApi.signup(payload);
    startSession(res.data);
    return res;
  }, [startSession]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* la session locale est fermée quoi qu'il arrive */ }
    clearSession();
  }, [clearSession]);

  const reloadUser = useCallback(async () => {
    const res = await authApi.me();
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const value = useMemo(() => ({
    user, status, setUser, login, signup, logout, reloadUser,
  }), [user, status, login, signup, logout, reloadUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
