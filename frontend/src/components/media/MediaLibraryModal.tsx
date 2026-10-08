import React, { useEffect, useState } from "react";
import { fetchMediaLibrary, deleteMediaItem } from "@/api/media";
import type { MediaItem } from "@/types";
import { CloseIcon } from "@/icons";

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MediaType = "images" | "audio" | "videos";

export const MediaLibraryModal: React.FC<MediaLibraryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MediaType>("images");
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLibrary();
    }
  }, [isOpen, activeTab]);

  const loadLibrary = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMediaLibrary(activeTab);
      setItems(result.items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load library";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    if (!confirm(`Delete ${filename}?`)) return;

    setDeleting(true);
    try {
      await deleteMediaItem(activeTab, filename);
      setItems((prev) => prev.filter((item) => item.filename !== filename));
      if (selectedMedia?.filename === filename) {
        setSelectedMedia(null);
      }
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleMediaClick = (item: MediaItem) => {
    setSelectedMedia(item);
  };

  const getMediaSource = (item: MediaItem) => {
    switch (item.type) {
      case "image":
        return `/api/media/library/${item.type}/${item.filename}`;
      case "audio":
        return `/api/media/library/${item.type}/${item.filename}`;
      case "video":
        return `/api/media/library/${item.type}/${item.filename}`;
      default:
        return "";
    }
  };

  const renderMediaContent = (item: MediaItem) => {
    const source = getMediaSource(item);

    switch (item.type) {
      case "image":
        return (
          <img
            src={source}
            alt={item.filename}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        );
      case "audio":
        return (
          <audio controls src={source} style={{ width: "100%" }} />
        );
      case "video":
        return (
          <video controls src={source} style={{ width: "100%", maxHeight: "80vh" }} />
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  const tabs: MediaType[] = ["images", "audio", "videos"];

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ background: "#18181b", borderRadius: 8, padding: 20, minWidth: 500, maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <h2 style={{ margin: 0 }}>Media Library</h2>
            <div style={{ display: "flex", gap: 4, background: "#121214", borderRadius: 6, padding: 4 }}>
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 4,
                    border: "none",
                    background: activeTab === tab ? "#58a6ff" : "transparent",
                    color: activeTab === tab ? "#fff" : "#a1a1aa",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: activeTab === tab ? 500 : 400,
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#888" }} aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </div>

        {error && <div style={{ color: "#f85149", padding: 8, borderRadius: 4, background: "rgba(248,81,73,0.1)", marginBottom: 16 }}>{error}</div>}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Loading media...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
            No {activeTab} found. Use <code>{activeTab.slice(0, -1)} &lt;description&gt;</code> to create one.
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            {items.map((item) => (
              <div
                key={item.filename}
                onClick={() => handleMediaClick(item)}
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
                  {item.type === "image" && (
                    <img
                      src={getMediaSource(item)}
                      alt={item.filename}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes("/api/")) {
                          target.src = `/api/media/library/${item.type}/${item.filename}`;
                        }
                      }}
                    />
                  )}
                  {item.type === "audio" && (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#58a6ff", background: "#18181b" }}>
                      <svg width={48} height={48} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    </div>
                  )}
                  {item.type === "video" && (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#f85149", background: "#18181b" }}>
                      <svg width={48} height={48} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                      </svg>
                    </div>
                  )}
                  <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 6, zIndex: 10 }}>
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
                      title="Delete media"
                      disabled={deleting}
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
                <div style={{ fontSize: 10, color: "#6c6c7e", marginTop: 4, textTransform: "uppercase" }}>
                  {item.type}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedMedia && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
            <button onClick={() => setSelectedMedia(null)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "#fff", fontSize: 24, cursor: "pointer" }}>✕</button>
            <div style={{ maxWidth: "90vw", maxHeight: "90vh" }}>
              {renderMediaContent(selectedMedia)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};