import { api } from "@/services/apiClient";
import type { ImageGenerationResult, MediaLibraryResponse } from "@/types";

export interface ImageGenerationRequest {
  prompt: string;
  width?: number;
  height?: number;
  model?: string;
  seed?: number;
}

export interface AudioGenerationRequest {
  prompt: string;
  model?: string;
}

export interface VideoGenerationRequest {
  prompt: string;
  duration?: number;
  width?: number;
  height?: number;
  model?: string;
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

export async function generateImage(payload: ImageGenerationRequest): Promise<ImageGenerationResult> {
  return api<ImageGenerationResult>("/media/generate-image", {
    method: "POST",
    body: payload,
  });
}

export async function generateAudio(payload: AudioGenerationRequest): Promise<AudioGenerationResult> {
  return api<AudioGenerationResult>("/media/generate-audio", {
    method: "POST",
    body: payload,
  });
}

export async function generateVideo(payload: VideoGenerationRequest): Promise<VideoGenerationResult> {
  return api<VideoGenerationResult>("/media/generate-video", {
    method: "POST",
    body: payload,
  });
}

export async function fetchMediaLibrary(type?: "images" | "audio" | "videos"): Promise<MediaLibraryResponse> {
  const params = type ? `?type=${type}` : "";
  return api<MediaLibraryResponse>(`/media/library${params}`);
}

export async function deleteMediaItem(type: string, filename: string) {
  return api<{ status: string; message: string }>(`/media/library/${type}/${filename}`, {
    method: "DELETE",
  });
}

export async function editLibraryImage(filename: string, prompt: string, model: string = "flux"): Promise<ImageGenerationResult> {
  return api<ImageGenerationResult>("/media/edit-image", {
    method: "POST",
    body: { filename, prompt, model },
  });
}
