import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/client';

/**
 * Charge des données et expose { data, loading, error, reload }.
 * Les réponses périmées (paramètres changés entre-temps) sont annulées et ignorées.
 */
export default function useFetch(fetcher, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const counter = useRef(0);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const id = ++counter.current;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher(controller.signal)
      .then((data) => { if (id === counter.current) setState({ data, loading: false, error: null }); })
      .catch((err) => {
        if (controller.signal.aborted || id !== counter.current) return;
        setState((s) => ({ ...s, loading: false, error: errorMessage(err) }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
