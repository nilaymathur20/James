/**
 * File service — wraps file-related API calls with TanStack Query hooks.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  searchFiles,
  previewFile,
  openFile,
  proposeEdit,
  applyEdit,
  undoEdit,
  listFileAudit,
} from '@/services/apiClient';
import type { FileMetadata, EditProposalResponse, ApplyEditResponse, UndoEditResponse } from '@/schemas/files';

// ----- Queries -----

export const useFileSearch = (query: string, limit = 10, enabled = false) =>
  useQuery({
    queryKey: ['file-search', query, limit],
    queryFn: () => searchFiles({ query, limit }),
    enabled: enabled && query.length > 0,
    staleTime: 30_000,
  });

export const useFilePreview = (fileId: string | null, enabled = false) =>
  useQuery({
    queryKey: ['file-preview', fileId],
    queryFn: () => previewFile({ file_id: fileId as string, max_chars: 20000 }),
    enabled: !!fileId && enabled,
    staleTime: 30_000,
  });

export const useFileAudit = () =>
  useQuery({
    queryKey: ['file-audit'],
    queryFn: () => listFileAudit(50),
    staleTime: 30_000,
  });

// ----- Mutations -----

export const useProposeEdit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { file_id: string; old_text: string; new_text: string }) => proposeEdit(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-audit'] });
    },
  });
};

export const useApplyEdit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { proposal_id: string; confirmed: boolean }) => applyEdit(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-audit'] });
    },
  });
};

export const useUndoEdit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { backup_id: string; confirmed: boolean }) => undoEdit(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-audit'] });
    },
  });
};

export const useOpenFile = () =>
  useMutation({
    mutationFn: (payload: { file_id: string; confirmed: boolean }) => openFile(payload),
  });

export type { FileMetadata, EditProposalResponse, ApplyEditResponse, UndoEditResponse };
