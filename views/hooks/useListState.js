import { useMemo, useState } from 'react';
import { useDebounce } from './useFetch';

/** État d'une liste CRUD : recherche (avec délai), filtres, tri, page, taille de page. */
export default function useListState({ sort: initialSort = '-createdAt', filters: initialFilters = {}, limit: initialLimit = 10 } = {}) {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSortState] = useState(initialSort);
  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(initialLimit);
  const debounced = useDebounce(q);

  const params = useMemo(() => ({ q: debounced, ...filters, sort, page, limit }), [debounced, filters, sort, page, limit]);
  return {
    q,
    setQ: (v) => { setQ(v); setPage(1); },
    filters,
    setFilter: (k) => (v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); },
    resetFilters: () => { setFilters(initialFilters); setQ(''); setPage(1); },
    sort,
    setSort: (v) => { setSortState(v); setPage(1); },
    page,
    setPage,
    setLimit: (v) => { setLimitState(v); setPage(1); },
    params,
  };
}
