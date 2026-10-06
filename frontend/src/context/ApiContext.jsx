import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { createSupabaseApi } from '../services/api';
import { createDemoApi } from '../services/demoApi';

const ApiContext = createContext(null);

/** Picks the real backend when a Supabase session is active, otherwise the in-memory demo implementation. */
export function ApiProvider({ children }) {
  const { profile, live } = useAuth();
  // Keyed on identity + role so a background profile refresh does not recreate the api and refetch every query.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const api = useMemo(() => (live ? createSupabaseApi(profile) : createDemoApi(profile)), [live, profile?.id, profile?.role]);
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApi = () => useContext(ApiContext);

/**
 * Load data through the api and keep it fresh (Supabase Realtime or the demo store notify on change).
 *   const { data, loading, error, reload } = useQuery((api) => api.listPending(), 'pending');
 * `key` identifies the query so a different dataset re-fetches.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useQuery(fn, key) {
  const api = useApi();
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const run = useCallback(async () => {
    try {
      const data = await fnRef.current(api);
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, [api]);

  useEffect(() => {
    run();
    const off = api.subscribe(run);
    return off;
  }, [run, api, key]);

  return { ...state, reload: run };
}
