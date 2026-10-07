import React from "react";
import type { FileCandidate } from "@/types";
import { FolderIcon, FileIcon } from "@/icons";

interface FileCandidatesProps {
  candidates?: FileCandidate[];
}

export const FileCandidates: React.FC<FileCandidatesProps> = ({ candidates }) => {
  if (!candidates || candidates.length === 0) return null;

  return (
    <div className="file-candidates" aria-label="Matching files">
      <span className="file-candidates-title">Matching Files</span>
      <div className="file-candidates-list">
        {candidates.map((cand, idx) => (
          <div key={`${cand.path}-${idx}`} className="file-candidate-item">
            <span className="file-icon">
              {cand.is_dir ? <FolderIcon size={14} /> : <FileIcon size={14} />}
            </span>
            <span className="file-path" title={cand.path}>
              {cand.path}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};