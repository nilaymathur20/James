/**
 * Zod schemas for indexing and health-related API payloads.
 * Mapped from backend/routers/health.py, indexing.py, transcription.py.
 */
import { z } from 'zod';

// --- Health: /api/health ---
export const HealthResponseSchema = z.object({
  status: z.string().optional(),
  indexed_chunks: z.number().optional(),
  catalogued_files: z.number().optional(),
  chat_provider: z.string().nullable().optional(),
  local_model: z.any().optional(),
  history: z
    .object({
      feature_enabled: z.boolean(),
      requires_request_opt_in: z.boolean().optional(),
    })
    .optional(),
  persistent_index: z.boolean().optional(),
  registered_roots: z.array(z.any()).optional(),
  index_database: z.string().optional(),
  voice: z
    .object({
      provider: z.string().optional(),
      package_installed: z.boolean().optional(),
      model_configured: z.boolean().optional(),
      model_loaded: z.boolean().optional(),
      keep_loaded: z.boolean().optional(),
    })
    .optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// --- Index status: /api/index-status ---
export const IndexStatusResponseSchema = z.object({
  indexed_chunks: z.number().optional(),
  catalogued_files: z.number().optional(),
  database: z.string().optional(),
  registered_roots: z.array(z.any()).optional(),
});
export type IndexStatusResponse = z.infer<typeof IndexStatusResponseSchema>;

// --- Index folder request: /api/index-folder ---
export const IndexFolderRequestSchema = z.object({
  path: z.string().min(1).max(4000),
  replace: z.boolean().default(false),
});
export type IndexFolderRequest = z.infer<typeof IndexFolderRequestSchema>;

export const IndexFolderResponseSchema = z.object({
  status: z.string(),
  message: z.string().optional(),
  folder: z.string().optional(),
  files_indexed: z.number().optional(),
  files_updated: z.number().optional(),
  files_unchanged: z.number().optional(),
  files_discoverable: z.number().optional(),
  skipped_files: z.number().optional(),
  chunks_added: z.number().optional(),
  total_chunks: z.number().optional(),
});
export type IndexFolderResponse = z.infer<typeof IndexFolderResponseSchema>;

// --- Scrape web request: /api/scrape-web ---
export const ScrapeWebRequestSchema = z.object({
  url: z.string().min(1).max(4000),
});
export type ScrapeWebRequest = z.infer<typeof ScrapeWebRequestSchema>;

export const ScrapeWebResponseSchema = z.object({
  status: z.string(),
  message: z.string().optional(),
  chunks_added: z.number().optional(),
  total_chunks: z.number().optional(),
  used_selenium: z.boolean().optional(),
});
export type ScrapeWebResponse = z.infer<typeof ScrapeWebResponseSchema>;

// --- Transcription status: /api/transcribe/status ---
export const TranscriptionStatusSchema = z.object({
  provider: z.string().optional(),
  package_installed: z.boolean().optional(),
  model_configured: z.boolean().optional(),
  model_loaded: z.boolean().optional(),
});
export type TranscriptionStatus = z.infer<typeof TranscriptionStatusSchema>;

// --- Transcription response: /api/transcribe ---
export const TranscriptionResponseSchema = z.object({
  provider: z.string(),
  text: z.string(),
  confidence: z.number().optional(),
});
export type TranscriptionResponse = z.infer<typeof TranscriptionResponseSchema>;

// --- Indexing progress event (emitted via WebSocket callback) ---
export const IndexProgressEventSchema = z.object({
  event_type: z.literal('index_progress'),
  phase: z.string(),
  message: z.string(),
  folder: z.string().optional(),
  url: z.string().optional(),
  files_seen: z.number().optional(),
  files_indexed: z.number().optional(),
  files_discoverable: z.number().optional(),
  skipped_files: z.number().optional(),
  chunks_added: z.number().optional(),
});
export type IndexProgressEvent = z.infer<typeof IndexProgressEventSchema>;
