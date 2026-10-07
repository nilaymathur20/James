/**
 * HTTP API client.
 * Uses the native fetch API (available in React Native / Expo) rather than
 * a third-party HTTP library, matching the existing frontend pattern.
 *
 * Per react-native-ui-ux-plan.md §8: never expose arbitrary paths — only
 * server-generated file_id / proposal_id / backup_id are sent.
 */
import { HealthResponseSchema } from '@/schemas/indexing';
import type { HealthResponse } from '@/schemas/indexing';
import type {
  ApplyEditRequest,
  ApplyEditResponse,
  EditProposalRequest,
  EditProposalResponse,
  FileAuditResponse,
  FilePreviewRequest,
  FilePreviewResponse,
  FileSearchRequest,
  FileSearchResponse,
  OpenFileRequest,
  UndoEditRequest,
  UndoEditResponse,
} from '@/schemas/files';
import type { AssistantRequest, AssistantResultPayload } from '@/schemas/assistant';
import type { IndexFolderRequest, IndexFolderResponse, ScrapeWebRequest, ScrapeWebResponse } from '@/schemas/indexing';
import { mapHttpError } from '@/utils/errors';

export interface ApiOptions {
  /** Raw base URL like http://192.168.1.5:8000. Defaults to /api (same origin). */
  baseUrl?: string;
  /** AbortController signal for cancellation. */
  signal?: AbortSignal;
}

let baseUrl = '/api';

/**
 * Configure the backend base URL.
 * In a mobile app this comes from connection settings (SecureStore),
 * never hard-coded to 127.0.0.1.
 */
export function setApiBaseUrl(url: string): void {
  baseUrl = url.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  return baseUrl;
}

async function request<T>(path: string, options: RequestInit & ApiOptions = {}): Promise<T> {
  const { baseUrl: override, signal, ...rest } = options;
  const base = override ?? baseUrl;
  const url = `${base}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      signal,
    });
  } catch (error) {
    throw mapHttpError(0, 'Unable to reach the local backend. Start FastAPI and try again.');
  }

  let parsed: unknown;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    parsed = await response.json().catch(() => ({}));
  } else {
    parsed = await response.text().catch(() => '');
  }

  if (!response.ok) {
    const detail =
      typeof parsed === 'object' && parsed !== null && 'detail' in parsed
        ? String((parsed as { detail: string }).detail)
        : typeof parsed === 'string'
        ? parsed
        : `Request failed with status ${response.status}.`;
    throw mapHttpError(response.status, detail);
  }

  return parsed as T;
}

// ----- Health -----
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return HealthResponseSchema.parse(await request<unknown>('/health', { signal }));
}

// ----- Assistant -----
export async function sendAssistantRequest(
  payload: AssistantRequest,
  signal?: AbortSignal,
): Promise<AssistantResultPayload> {
  return request<AssistantResultPayload>('/assistant', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ----- Search -----
export async function searchFiles(payload: FileSearchRequest, signal?: AbortSignal): Promise<FileSearchResponse> {
  return request<FileSearchResponse>('/files/search', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ----- File preview -----
export async function previewFile(payload: FilePreviewRequest, signal?: AbortSignal): Promise<FilePreviewResponse> {
  return request<FilePreviewResponse>('/files/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ----- Open file -----
export async function openFile(payload: OpenFileRequest, signal?: AbortSignal): Promise<unknown> {
  return request<unknown>('/files/open', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ----- Edit proposal -----
export async function proposeEdit(payload: EditProposalRequest, signal?: AbortSignal): Promise<EditProposalResponse> {
  return request<EditProposalResponse>('/files/propose-edit', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ----- Apply edit -----
export async function applyEdit(payload: ApplyEditRequest, signal?: AbortSignal): Promise<ApplyEditResponse> {
  return request<ApplyEditResponse>('/files/apply-edit', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ----- Undo edit -----
export async function undoEdit(payload: UndoEditRequest, signal?: AbortSignal): Promise<UndoEditResponse> {
  return request<UndoEditResponse>('/files/undo-edit', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ----- File audit -----
export async function listFileAudit(limit = 50, signal?: AbortSignal): Promise<FileAuditResponse> {
  return request<FileAuditResponse>(`/files/audit?limit=${limit}`, { signal });
}

// ----- Indexing -----
export async function indexFolder(payload: IndexFolderRequest, signal?: AbortSignal): Promise<IndexFolderResponse> {
  return request<IndexFolderResponse>('/index-folder', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function scrapeWeb(payload: ScrapeWebRequest, signal?: AbortSignal): Promise<ScrapeWebResponse> {
  return request<ScrapeWebResponse>('/scrape-web', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ----- Transcription -----
export async function transcribeAudio(
  formData: FormData,
  signal?: AbortSignal,
): Promise<{ provider: string; text: string; confidence?: number }> {
  const blob = formData.get('audio') as Blob;
  return request<{ provider: string; text: string; confidence?: number }>('/transcribe', {
    method: 'POST',
    body: formData,
    signal,
  });
}
