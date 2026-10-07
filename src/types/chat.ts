export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  data: string; // Base64 data or plain text
  size: number;
}

export interface MessageStats {
  durationMs: number;
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  tokensPerSecond?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  thought?: string; // Captured reasoning / thinking chain
  timestamp: number;
  attachments?: Attachment[];
  stats?: MessageStats;
  pinned?: boolean;
  variants?: string[]; // Multiple regenerations
  variantIndex?: number;
  isError?: boolean;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  badge: string;
  accentColor: string;
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
  icon?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  messages: Message[];
  systemInstruction: string;
  model: string;
  temperature: number;
  topP: number;
  maxOutputTokens: number;
  personaId: string;
  folderId?: string | null; // Associated project / folder
  enableThinking?: boolean; // Reasoning mode enabled
  thinkingBudget?: number; // Thinking tokens budget (e.g. 2048)
  contextWindowStrategy: 'all' | 'last10' | 'last20';
}

export interface EditorDocument {
  id: string;
  title: string;
  content: string;
  language: string;
  folderId?: string | null;
  updatedAt: number;
}

export interface AutoIndexedFile {
  id: string;
  name: string;
  path?: string;
  content: string;
  size: number;
  tokenCount: number;
  indexedAt: number;
}

export interface TranscriptionRecord {
  id: string;
  filename: string;
  mimeType: string;
  transcript: string;
  durationMs: number;
  createdAt: number;
}

export interface LibraryTemplate {
  id: string;
  title: string;
  category: 'system' | 'coding' | 'writing' | 'analysis' | 'workflow';
  description: string;
  prompt: string;
  personaId?: string;
}

export interface TokenMetrics {
  totalSessionTokens: number;
  maxContextWindow: number;
  lastTurnTokens: number;
  tokensPerSecond: string;
  averageLatencyMs: number;
}
