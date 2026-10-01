/**
 * Zod schemas for assistant-related API and WebSocket payloads.
 * Mapped from backend/routers/assistant.py, assistant_ws.py,
 * services/assistant_flow.py, and services/command_handler.py.
 */
import { z } from 'zod';

// --- Assistant request (HTTP POST /api/assistant) ---
export const AssistantRequestSchema = z.object({
  text: z.string().min(1, 'text must be non-empty').max(20000),
  use_history: z.boolean().default(false),
  source: z.enum(['typed', 'voice', 'paste']).default('typed'),
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

// --- Source chunk returned in results / file_candidates ---
export const SourceChunkSchema = z.object({
  source: z.string(),
  source_type: z.string(),
  score: z.number().optional(),
  snippet: z.string().optional(),
  chunk_index: z.number().optional(),
});
export type SourceChunk = z.infer<typeof SourceChunkSchema>;

export const FileCandidateSchema = z.object({
  path: z.string(),
  name: z.string().optional(),
  is_dir: z.boolean().optional(),
  size: z.number().optional(),
  modified: z.string().optional(),
});
export type FileCandidate = z.infer<typeof FileCandidateSchema>;

// --- Assistant result payload (final result on both transports) ---
export const AssistantResultPayloadSchema = z.object({
  kind: z.string().optional(),
  response: z.string().optional(),
  mode: z.string().optional(),
  provider: z.string().nullable().optional(),
  provider_error: z.string().nullable().optional(),
  results: z.array(SourceChunkSchema).optional(),
  file_candidates: z.array(FileCandidateSchema).optional(),
  media_url: z.string().optional(),
  media_type: z.enum(['image', 'audio', 'file']).optional(),
});
export type AssistantResultPayload = z.infer<typeof AssistantResultPayloadSchema>;

// --- WebSocket outbound request (what the client sends) ---
export const WsOutboundMessageSchema = z.object({
  type: z.literal('assistant_message').or(z.literal('ping')),
  request_id: z.string().min(1).max(100),
  text: z.string().min(1).max(20000).optional(),
  source: z.enum(['typed', 'voice', 'paste']).optional(),
  use_history: z.boolean().optional(),
});
export type WsOutboundMessage = z.infer<typeof WsOutboundMessageSchema>;

// --- WebSocket inbound event types ---
export const WsReadySchema = z.object({
  type: z.literal('ready'),
  protocol: z.string(),
  message: z.string().optional(),
});

export const WsPongSchema = z.object({
  type: z.literal('pong'),
});

export const WsStatusSchema = z.object({
  type: z.literal('assistant_status'),
  request_id: z.string().optional(),
  phase: z.string().optional(),
  message: z.string().optional(),
});

export const WsIndexProgressSchema = z.object({
  type: z.literal('index_progress'),
  request_id: z.string().optional(),
  phase: z.string().optional(),
  message: z.string().optional(),
  scanned: z.number().optional(),
  indexed: z.number().optional(),
  skipped: z.number().optional(),
  files_seen: z.number().optional(),
  files_indexed: z.number().optional(),
  files_discoverable: z.number().optional(),
  skipped_files: z.number().optional(),
  chunks_added: z.number().optional(),
  folder: z.string().optional(),
  url: z.string().optional(),
});

export const WsAgentThoughtSchema = z.object({
  type: z.literal('agent_thought'),
  request_id: z.string().optional(),
  thought: z.string().optional(),
  content: z.string().optional(),
});

export const WsToolCallSchema = z.object({
  type: z.literal('tool_call'),
  request_id: z.string().optional(),
  tool_name: z.string().optional(),
  tool: z.string().optional(),
  input: z.record(z.string(), z.any()).optional(),
  params: z.record(z.string(), z.any()).optional(),
});

export const WsToolResultSchema = z.object({
  type: z.literal('tool_result'),
  request_id: z.string().optional(),
  tool_name: z.string().optional(),
  tool: z.string().optional(),
  result: z.unknown().optional(),
});

export const WsTokenDeltaSchema = z.object({
  type: z.literal('token_delta'),
  request_id: z.string().optional(),
  delta: z.string().optional(),
});

export const WsConfirmationSchema = z.object({
  type: z.literal('confirmation_required'),
  request_id: z.string().optional(),
  proposal_id: z.string().optional(),
  tool: z.string().optional(),
  params: z.record(z.string(), z.any()).optional(),
});

export const WsResultSchema = z.object({
  type: z.literal('assistant_result'),
  request_id: z.string(),
  result: AssistantResultPayloadSchema,
});

export const WsErrorSchema = z.object({
  type: z.literal('error'),
  code: z.string().optional(),
  message: z.string(),
  status_code: z.number().optional(),
  request_id: z.string().optional(),
});

// Using a regular union since discriminatedUnion requires all members
// to share the discriminator field with literal values — which they do,
// but Zod v4's API differs slightly.
export const WsInboundMessageSchema = z.union([
  WsReadySchema,
  WsPongSchema,
  WsStatusSchema,
  WsIndexProgressSchema,
  WsAgentThoughtSchema,
  WsToolCallSchema,
  WsToolResultSchema,
  WsConfirmationSchema,
  WsTokenDeltaSchema,
  WsResultSchema,
  WsErrorSchema,
]);
export type WsInboundMessage = z.infer<typeof WsInboundMessageSchema>;

// --- High-level event union for the UI ---
export type AssistantEvent =
  | { type: 'ready'; protocol: string; message?: string }
  | { type: 'assistant_status'; phase?: string; message?: string; request_id?: string; data?: Record<string, unknown> }
  | { type: 'index_progress'; scanned?: number; indexed?: number; skipped?: number; phase?: string; message?: string }
  | { type: 'agent_thought'; thought?: string; content?: string }
  | { type: 'tool_call'; tool_name?: string; input?: Record<string, unknown> }
  | { type: 'tool_result'; tool_name?: string; result?: unknown }
  | { type: 'confirmation_required'; proposal_id?: string; tool?: string; params?: Record<string, unknown> }
  | { type: 'token_delta'; delta?: string }
  | { type: 'assistant_result'; request_id?: string; result: AssistantResultPayload }
  | { type: 'error'; code?: string; message: string; status_code?: number };
