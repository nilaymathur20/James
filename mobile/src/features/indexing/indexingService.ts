/**
 * Indexing feature service — wraps index-folder and index-status APIs
 * with TanStack Query hooks.
 * Per react-native-ui-ux-plan.md §4E (Indexing screen) and §6 (features/indexing).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { indexFolder, fetchHealth } from '@/services/apiClient';
import type { IndexFolderRequest, IndexFolderResponse } from '@/schemas/indexing';
import { useSessionStore } from '@/stores/sessionStore';

// ----- Mutations -----
export const useIndexFolder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: IndexFolderRequest) => indexFolder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['index-status'] });
      queryClient.invalidateQueries({ queryKey: ['backend-health'] });
    },
  });
};

// ----- Queries -----
export const useIndexStatus = (enabled = true) => {
  const { backendUrl } = useSessionStore();
  return useQuery({
    queryKey: ['index-status'],
    queryFn: () => fetchHealth(),
    enabled: enabled && !!backendUrl,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
};

export type { IndexFolderResponse };
