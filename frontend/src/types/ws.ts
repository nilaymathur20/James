import { z } from "zod";

export const WsReady = z.object({
  type: z.literal("ready"),
  protocol: z.string(),
  message: z.string(),
});

export const WsAssistantStatus = z.object({
  type: z.literal("assistant_status"),
  request_id: z.string(),
  phase: z.enum(["accepted", "thinking", "tool_call", "streaming", "complete", "cancelled", "error"]),
  message: z.string().optional(),
  budget_remaining_ms: z.number().optional(),
  step: z.number().optional(),
  max_steps: z.number().optional(),
});

export const WsIndexProgress = z.object({
  type: z.literal("index_progress"),
  request_id: z.string().optional(),
  phase: z.string(),
  message: z.string(),
  files_scanned: z.number().optional(),
  chunks_added: z.number().optional(),
  skipped: z.number().optional(),
  total_estimated: z.number().optional(),
});

export const WsAgentThought = z.object({
  type: z.literal("agent_thought"),
  request_id: z.string(),
  thought: z.string(),
});

export const WsToolCall = z.object({
  type: z.literal("tool_call"),
  request_id: z.string(),
  tool: z.string(),
  args: z.record(z.string(), z.string()),
  
  proposal_id: z.string().optional(),
});

export const WsToolResult = z.object({
  type: z.literal("tool_result"),
  request_id: z.string(),
  tool: z.string(),
  result: z.string(),
  proposal_id: z.string().optional(),
  duration_ms: z.number().optional(),
});

export const WsTokenDelta = z.object({
  type: z.literal("token_delta"),
  request_id: z.string().optional(),
  delta: z.string(),
});

export const WsError = z.object({
  type: z.literal("error"),
  code: z.string(),
  message: z.string(),
  status_code: z.number().optional(),
  request_id: z.string().optional(),
});

export const WsPong = z.object({
  type: z.literal("pong"),
});

export const WsAssistantResult = z.object({
  type: z.literal("assistant_result"),
  request_id: z.string(),
  result: z.record(z.string(), z.string()),
});

export type WsReady = z.infer<typeof WsReady>;
export type WsAssistantStatus = z.infer<typeof WsAssistantStatus>;
export type WsIndexProgress = z.infer<typeof WsIndexProgress>;
export type WsAgentThought = z.infer<typeof WsAgentThought>;
export type WsToolCall = z.infer<typeof WsToolCall>;
export type WsToolResult = z.infer<typeof WsToolResult>;
export type WsTokenDelta = z.infer<typeof WsTokenDelta>;
export type WsError = z.infer<typeof WsError>;
export type WsPong = z.infer<typeof WsPong>;
export type WsAssistantResult = z.infer<typeof WsAssistantResult>;

export type WsInbound =
  | WsReady
  | WsAssistantStatus
  | WsIndexProgress
  | WsAgentThought
  | WsToolCall
  | WsToolResult
  | WsTokenDelta
  | WsError
  | WsPong
  | WsAssistantResult;

export interface WsOutboundMessage {
  type: "assistant_message" | "confirm_tool" | "reject_tool" | "ping";
  request_id: string;
  text?: string;
  source?: "typed" | "voice" | "paste";
  use_history?: boolean;
  proposal_id?: string;
}
