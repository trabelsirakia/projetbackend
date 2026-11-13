import axios from 'axios';

/**
 * Client HTTP unique.
 * - Le jeton d'accès reste en mémoire (jamais dans localStorage).
 * - Sur 401 TOKEN_EXPIRED : un seul /auth/refresh à la fois (cookie httpOnly), puis on rejoue la requête.
 * - Si la session est perdue ou le compte bloqué, AuthContext est prévenu via onSessionLost.
 */
const api = axios.create({ baseURL: '/api', withCredentials: true, timeout: 60000 });

const NO_RETRY = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout'];

let accessToken = null;
let refreshPromise = null;
let sessionLostHandler = () => {};

export const setAccessToken = (token) => { accessToken = token; };
export const getAccessToken = () => accessToken;
export const onSessionLost = (fn) => { sessionLostHandler = fn; };

// Partagé entre tous les appelants (et les doubles effets de React StrictMode).
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/auth/refresh', {}, { withCredentials: true, timeout: 15000 })
      .then((res) => {
        setAccessToken(res.data.data.accessToken);
        return res.data.data;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const code = response?.data?.code;
    const isAuthCall = NO_RETRY.some((p) => config?.url?.startsWith(p));

    // Compte bloqué pendant une session ouverte : on déconnecte. (Sur /login, la page affiche déjà le message.)
    if (response?.status === 403 && code === 'ACCOUNT_BLOCKED' && !isAuthCall) {
      setAccessToken(null);
      sessionLostHandler('blocked');
      return Promise.reject(error);
    }

    const canRetry = response?.status === 401
      && code === 'TOKEN_EXPIRED'
      && config && !config._retried
      && !isAuthCall;

    if (!canRetry) return Promise.reject(error);

    try {
      config._retried = true;
      await refreshSession();
      config.headers.Authorization = `Bearer ${accessToken}`;
      return api(config);
    } catch (refreshError) {
      setAccessToken(null);
      const reason = refreshError.response?.data?.code === 'ACCOUNT_BLOCKED' ? 'blocked' : 'expired';
      sessionLostHandler(reason);
      return Promise.reject(error);
    }
  },
);

// Message lisible à partir d'une erreur Axios.
export function errorMessage(error, fallback = 'Une erreur est survenue. Réessayez.') {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ECONNABORTED') return 'Le serveur met trop de temps à répondre.';
  if (error?.request && !error.response) return 'Serveur injoignable. Vérifiez que le backend est démarré.';
  return fallback;
}

export const errorCode = (error) => error?.response?.data?.code;

// Applique les erreurs de validation du backend (422/409) aux champs de React Hook Form.
export function applyFieldErrors(error, setError, allowed = []) {
  const list = error?.response?.data?.errors;
  if (!Array.isArray(list)) return false;
  let applied = false;
  for (const { field, message } of list) {
    if (!allowed.length || allowed.includes(field)) {
      setError(field, { type: 'server', message });
      applied = true;
    }
  }
  return applied;
}

export default api;
