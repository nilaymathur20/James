export type MessageRole = "user" | "assistant" | "system";

export interface SourceChunk {
  source: string;
  source_type: string;
  score?: number;
  snippet?: string;
  chunk_index?: number;
  device_id?: string;
}

export interface FileCandidate {
  path: string;
  name?: string;
  is_dir?: boolean;
  size?: number;
  modified?: string;
}

export interface ToolCallProposal {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  requires_confirmation?: boolean;
  status?: "pending" | "approved" | "rejected" | "executing" | "completed" | "failed";
  result?: string;
  error?: string;
}

export interface ReActStep {
  step: number;
  thought?: string;
  action?: {
    tool: string;
    params: Record<string, unknown>;
  };
  observation?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  time: string;
  kind?: string;
  mode?: string;
  sources?: SourceChunk[];
  fileCandidates?: FileCandidate[];
  providerError?: string | null;
  thought?: string;
  steps?: ReActStep[];
  toolProposals?: ToolCallProposal[];
  mediaType?: "image" | "audio" | "video" | "file";
  mediaUrl?: string;
  data?: Record<string, unknown>;
}

export interface AssistantResultPayload {
  response?: string;
  kind?: string;
  mode?: string;
  results?: SourceChunk[];
  file_candidates?: FileCandidate[];
  provider_error?: string | null;
  tool_proposals?: ToolCallProposal[];
  steps?: ReActStep[];
  thought?: string;
  media_url?: string;
  media_type?: "image" | "audio" | "video" | "file";
  images?: Array<{ thumbnail?: string; url?: string; title?: string }>;
}

export interface ImageGenerationResult {
  prompt: string;
  image_url: string;
  local_path?: string | null;
  filename?: string | null;
  model: string;
  dimensions: string;
  success: boolean;
  error?: string;
}

export interface LibraryImageItem {
  filename: string;
  local_path: string;
  url: string;
  size: number;
  modified: number;
}
