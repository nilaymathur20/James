/**
 * Zod schemas for file-related API payloads.
 * Mapped from backend/routers/files.py and services/file_tools.py.
 */
import { z } from 'zod';

// --- Serialized file catalog entry (from file_tools.serialize_file_entry) ---
export const FileMetadataSchema = z.object({
  file_id: z.string(),
  name: z.string(),
  path: z.string(),
  extension: z.string(),
  category: z.string(),
  reason: z.string().nullable().optional(),
  size_bytes: z.number().nullable().optional(),
  can_open: z.boolean(),
  can_preview: z.boolean(),
  can_edit: z.boolean(),
});
export type FileMetadata = z.infer<typeof FileMetadataSchema>;

// --- Search results: /api/files/search ---
export const FileSearchResponseSchema = z.object({
  status: z.string(),
  results: z.array(FileMetadataSchema),
});
export type FileSearchResponse = z.infer<typeof FileSearchResponseSchema>;

// --- File preview: /api/files/preview ---
export const FilePreviewResponseSchema = z.object({
  file: FileMetadataSchema,
  content: z.string(),
  truncated: z.boolean(),
  audit_id: z.string().optional(),
});
export type FilePreviewResponse = z.infer<typeof FilePreviewResponseSchema>;

// --- Edit proposal: /api/files/propose-edit ---
export const EditProposalResponseSchema = z.object({
  status: z.string(),
  requires_confirmation: z.boolean(),
  proposal_id: z.string().optional(),
  expires_at: z.string().optional(),
  file: FileMetadataSchema,
  diff: z.string().optional(),
  message: z.string().optional(),
  audit_id: z.string().optional(),
});
export type EditProposalResponse = z.infer<typeof EditProposalResponseSchema>;

// --- Apply edit: /api/files/apply-edit ---
export const ApplyEditResponseSchema = z.object({
  status: z.string(),
  requires_confirmation: z.boolean().optional(),
  proposal_id: z.string().optional(),
  expires_at: z.string().optional(),
  file: FileMetadataSchema.optional(),
  diff: z.string().optional(),
  message: z.string().optional(),
  backup_id: z.string().optional(),
  backup_path: z.string().optional(),
  audit_id: z.string().optional(),
});
export type ApplyEditResponse = z.infer<typeof ApplyEditResponseSchema>;

// --- Undo edit: /api/files/undo-edit ---
export const UndoEditResponseSchema = z.object({
  status: z.string(),
  requires_confirmation: z.boolean().optional(),
  backup_id: z.string(),
  message: z.string().optional(),
  file: FileMetadataSchema.optional(),
  audit_id: z.string().optional(),
});
export type UndoEditResponse = z.infer<typeof UndoEditResponseSchema>;

// --- File audit list: /api/files/audit ---
export const FileAuditEventSchema = z.object({
  event_id: z.string(),
  event_type: z.string(),
  outcome: z.string(),
  file_id: z.string().nullable().optional(),
  file_name: z.string().nullable().optional(),
  proposal_id: z.string().nullable().optional(),
  backup_id: z.string().nullable().optional(),
  created_at: z.string(),
});
export type FileAuditEvent = z.infer<typeof FileAuditEventSchema>;

export const FileAuditResponseSchema = z.object({
  status: z.string(),
  results: z.array(FileAuditEventSchema),
});
export type FileAuditResponse = z.infer<typeof FileAuditResponseSchema>;

// --- Request payloads (sent from mobile) ---
export const FileSearchRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  limit: z.number().min(1).max(50).default(10),
});

export const FilePreviewRequestSchema = z.object({
  file_id: z.string().min(1).max(100),
  max_chars: z.number().min(1).max(20000).default(20000),
});

export const OpenFileRequestSchema = z.object({
  file_id: z.string().min(1).max(100),
  confirmed: z.boolean().default(false),
});

export const EditProposalRequestSchema = z.object({
  file_id: z.string().min(1).max(100),
  old_text: z.string().min(1).max(200000),
  new_text: z.string().max(200000),
});

export const ApplyEditRequestSchema = z.object({
  proposal_id: z.string().min(1).max(100),
  confirmed: z.boolean().default(false),
});

export const UndoEditRequestSchema = z.object({
  backup_id: z.string().min(1).max(100),
  confirmed: z.boolean().default(false),
});

// --- Request payload types ---
export type FileSearchRequest = z.infer<typeof FileSearchRequestSchema>;
export type FilePreviewRequest = z.infer<typeof FilePreviewRequestSchema>;
export type OpenFileRequest = z.infer<typeof OpenFileRequestSchema>;
export type EditProposalRequest = z.infer<typeof EditProposalRequestSchema>;
export type ApplyEditRequest = z.infer<typeof ApplyEditRequestSchema>;
export type UndoEditRequest = z.infer<typeof UndoEditRequestSchema>;
