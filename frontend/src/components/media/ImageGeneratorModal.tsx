import React, { useState } from "react";
import { generateImage } from "@/api/image";
import type { ImageGenerationResult } from "@/types";
import { CloseIcon } from "@/icons";

interface ImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageGenerated?: (result: ImageGenerationResult) => void;
}

export const ImageGeneratorModal: React.FC<ImageGeneratorModalProps> = ({
  isOpen,
  onClose,
  onImageGenerated,
}) => {
  const [prompt, setPrompt] = useState("");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<ImageGenerationResult | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);
    
    try {
      const result = await generateImage({
        prompt: prompt.trim(),
        width,
        height,
      });
      setGeneratedImage(result);
      onImageGenerated?.(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate image";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isGenerating) {
      handleGenerate();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ background: "#18181b", borderRadius: 8, padding: 20, minWidth: 400, maxWidth: 600, maxHeight: "90vh", overflow: "auto" }}>
        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Generate Image</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#888" }} aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe what you want to generate..."
            rows={3}
            style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #333", background: "#121214", color: "#fff", resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Width</label>
            <select value={width} onChange={(e) => setWidth(parseInt(e.target.value))} style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #333", background: "#121214", color: "#fff" }}>
              <option value={256}>256</option>
              <option value={512}>512</option>
              <option value={768}>768</option>
              <option value={1024}>1024</option>
              <option value={1536}>1536</option>
              <option value={2048}>2048</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Height</label>
            <select value={height} onChange={(e) => setHeight(parseInt(e.target.value))} style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #333", background: "#121214", color: "#fff" }}>
              <option value={256}>256</option>
              <option value={512}>512</option>
              <option value={768}>768</option>
              <option value={1024}>1024</option>
              <option value={1536}>1536</option>
              <option value={2048}>2048</option>
            </select>
          </div>
        </div>

        {error && <div style={{ color: "#f85149", padding: 8, borderRadius: 4, background: "rgba(248,81,73,0.1)", marginBottom: 16 }}>{error}</div>}

        <button onClick={handleGenerate} disabled={!prompt.trim() || isGenerating} style={{ width: "100%", padding: 12, borderRadius: 4, border: "none", background: "#33c6ff", color: "#000", fontWeight: 600, cursor: isGenerating ? "not-allowed" : "pointer", opacity: isGenerating ? 0.6 : 1 }}>
          {isGenerating ? "Generating…" : "Generate"}
        </button>

        {generatedImage && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ margin: "0 0 8 0" }}>Generated Image</h3>
            <img src={generatedImage.image_url} alt={generatedImage.prompt} style={{ maxWidth: "100%", borderRadius: 4, border: "1px solid #333" }} />
            <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
              Model: {generatedImage.model} | {generatedImage.dimensions}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};