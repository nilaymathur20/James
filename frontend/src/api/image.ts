import { api } from "@/services/apiClient";
import type { ImageGenerationResult } from "@/types";

export interface ImageGenerationRequest {
  prompt: string;
  width?: number;
  height?: number;
  model?: string;
  seed?: number;
}

export async function generateImage(payload: ImageGenerationRequest): Promise<ImageGenerationResult> {
  return api<ImageGenerationResult>("/media/generate-image", {
    method: "POST",
    body: payload,
  });
}

// Re-export library functions from media API
export async function fetchImageLibrary() {
  return api<{ items: any[]; total: number }>("/media/library");
}

export async function fetchLibraryImage(filename: string) {
  return api<{ filename: string; local_path: string; mime: string; base64: string }>(`/media/library/image/${filename}`);
}

export async function deleteLibraryImage(filename: string) {
  return api<{ status: string; message: string }>(`/media/library/image/${filename}`, {
    method: "DELETE",
  });
}

export async function editLibraryImage(filename: string, prompt: string, model: string = "flux"): Promise<ImageGenerationResult> {
  return api<ImageGenerationResult>("/media/edit-image", {
    method: "POST",
    body: { filename, prompt, model },
  });
}