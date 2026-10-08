import React, { useEffect, useState } from "react";
import { fetchImageLibrary, deleteLibraryImage, editLibraryImage } from "@/api/image";
import type { LibraryImageItem } from "@/types";
import { CloseIcon } from "@/icons";

interface ImageLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImageLibraryModal: React.FC<ImageLibraryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [items, setItems] = useState<LibraryImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingFilename, setEditingFilename] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState<string>("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLibrary();
    }
  }, [isOpen]);

  const loadLibrary = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchImageLibrary();
      setItems(result.items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load library";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (item: LibraryImageItem) => {
    setSelectedImage(`/api/media/library/image/${item.filename}`);
  };

  const handleDelete = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    if (!confirm(`Delete ${filename}?`)) return;
    try {
      await deleteLibraryImage(filename);
      setItems((prev) => prev.filter((item) => item.filename !== filename));
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleEdit = (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    setEditingFilename(filename);
    setEditPrompt("");
  };

  const handleSubmitEdit = async () => {
    if (!editingFilename || !editPrompt.trim()) return;
    setEditing(true);
    setError(null);
    try {
      const result = await editLibraryImage(editingFilename, editPrompt);
      if (result.success) {
        // Reload the library to show the new edited image
        await loadLibrary();
        setEditingFilename(null);
        setEditPrompt("");
        alert(`Image edited successfully! New image saved.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to edit image";
      setError(msg);
    } finally {
      setEditing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ background: "#18181b", borderRadius: 8, padding: 20, minWidth: 500, maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Image Library ({items.length})</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#888" }} aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </div>

        {error && <div style={{ color: "#f85149", padding: 8, borderRadius: 4, background: "rgba(248,81,73,0.1)", marginBottom: 16 }}>{error}</div>}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Loading library...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
            No images generated yet. Use <code>image &lt;description&gt;</code> to create one.
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            {items.map((item) => (
              <div
                key={item.filename}
                onClick={() => handleImageClick(item)}
                style={{
                  cursor: "pointer",
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  padding: 8,
                  background: "#121214",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                <div style={{ position: "relative", width: "100%", height: 120, borderRadius: 6, overflow: "hidden", background: "#18181b" }}>
                  <img
                    src={`/api/media/library/image/${item.filename}`}
                    alt={item.filename}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      // Fallback if /api prefix fails
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes("/api/")) {
                        target.src = `/api/media/library/image/${item.filename}`;
                      }
                    }}
                  />
                  <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 6, zIndex: 10 }}>
                    <button
                      onClick={(e) => handleEdit(e, item.filename)}
                      style={{
                        background: "rgba(0,0,0,0.75)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "50%",
                        width: 28,
                        height: 28,
                        color: "#58a6ff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        backdropFilter: "blur(4px)",
                      }}
                      title="Edit image with prompt"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, item.filename)}
                      style={{
                        background: "rgba(0,0,0,0.75)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "50%",
                        width: 28,
                        height: 28,
                        color: "#f85149",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        backdropFilter: "blur(4px)",
                      }}
                      title="Delete image"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#a1a1aa",
                    marginTop: 8,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    width: "100%",
                  }}
                  title={item.filename}
                >
                  {item.filename}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedImage && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
            <button onClick={() => setSelectedImage(null)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "#fff", fontSize: 24, cursor: "pointer" }}>✕</button>
            <img src={selectedImage} alt="Full size" style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" }} />
          </div>
        )}

        {editingFilename && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
            <div style={{ background: "#18181b", borderRadius: 8, padding: 24, width: 500, maxWidth: "90vw" }}>
              <h3 style={{ margin: "0 0 16px 0" }}>Edit Image: {editingFilename}</h3>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Describe how to edit this image (e.g., 'add a hat', 'make it daytime', 'change background to ocean')"
                style={{ width: "100%", minHeight: 80, padding: 8, borderRadius: 4, border: "1px solid #333", background: "#121214", color: "#fff", fontFamily: "inherit", fontSize: 14 }}
                disabled={editing}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setEditingFilename(null);
                    setEditPrompt("");
                  }}
                  style={{ padding: "8px 16px", borderRadius: 4, border: "1px solid #333", background: "#18181b", color: "#fff", cursor: "pointer" }}
                  disabled={editing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitEdit}
                  style={{ padding: "8px 16px", borderRadius: 4, border: "none", background: "#58a6ff", color: "#fff", cursor: "pointer", opacity: editing || !editPrompt.trim() ? 0.5 : 1 }}
                  disabled={editing || !editPrompt.trim()}
                >
                  {editing ? "Editing..." : "Edit Image"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};