/**
 * Connection / backend health hook.
 * Per react-native-ui-ux-plan.md §4: provides a first-run connection
 * experience with three explicit options (local, paired, demo/offline).
 * Uses TanStack Query to poll /api/health.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '@/services/apiClient';
import { useSessionStore } from '@/stores/sessionStore';
import { useEffect } from 'react';
import type { HealthResponse } from '@/schemas/indexing';

export { useSessionStore as useConnectionStore };

export const useBackendHealth = (enabled = true) => {
  const { setBackendUrl } = useSessionStore();

  const query = useQuery({
    queryKey: ['backend-health'],
    queryFn: () => fetchHealth(),
    enabled,
    refetchInterval: 15_000,
    staleTime: 5_000,
    retry: 2,
    retryDelay: 2000,
  });

  // Sync backend URL on first successful response
  useEffect(() => {
    if (query.data?.index_database && query.isSuccess) {
      // Already configured via session store
    }
  }, [query.data, query.isSuccess, setBackendUrl]);

  return {
    health: query.data as HealthResponse | undefined,
    isChecking: query.isFetching,
    isOnline: query.isSuccess,
    isOffline: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
};

export type ConnectionOption = 'local' | 'paired' | 'demo';

export interface ConnectionState {
  option: ConnectionOption;
  backendUrl: string | null;
  connected: boolean;
}
