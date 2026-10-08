export interface MediaItem {
  filename: string;
  type: "image" | "audio" | "video";
  local_path: string;
  url: string;
  size: number;
  modified: number;
}

export interface MediaLibraryResponse {
  items: MediaItem[];
  total: number;
}

export interface ImageGenerationResult {
  prompt: string;
  image_url: string;
  local_path: string | null;
  filename: string | null;
  model: string;
  dimensions: string;
  type: "image";
  is_edit: boolean;
  success: boolean;
  error?: string;
}

export interface AudioGenerationResult {
  prompt: string;
  audio_url: string;
  local_path: string | null;
  filename: string | null;
  model: string;
  type: "audio";
  success: boolean;
  error?: string;
}

export interface VideoGenerationResult {
  prompt: string;
  video_url: string;
  local_path: string | null;
  filename: string | null;
  model: string;
  duration: number;
  dimensions: string;
  type: "video";
  success: boolean;
  error?: string;
}