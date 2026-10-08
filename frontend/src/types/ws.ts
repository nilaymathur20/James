import type { AssistantResultPayload, ReActStep, ToolCallProposal } from "./chat";

export type WebSocketMessageType =
  | "ready"
  | "assistant_status"
  | "index_progress"
  | "assistant_result"
  | "agent_thought"
  | "agent_step"
  | "tool_call"
  | "tool_result"
  | "token_delta"
  | "error"
  | "pong";

export interface WebSocketInboundMessage {
  type: WebSocketMessageType;
  request_id?: string;
  message?: string;
  text?: string;
  result?: AssistantResultPayload;
  step?: ReActStep;
  tool_proposal?: ToolCallProposal;
  delta?: string;
}

export interface WebSocketOutboundMessage {
  type: "assistant_message" | "confirm_tool" | "reject_tool" | "ping";
  request_id: string;
  text?: string;
  source?: "typed" | "voice" | "paste";
  use_history?: boolean;
  proposal_id?: string;
  attachments?: Array<{ name: string; type: string; data: string }>;
}
