import React from "react";
import type { ToolCallProposal } from "@/types";

interface DiffViewerProps {
  proposals?: ToolCallProposal[];
  onApprove?: (proposalId: string) => void;
  onReject?: (proposalId: string) => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  proposals,
  onApprove,
  onReject,
}) => {
  if (!proposals || proposals.length === 0) return null;

  return (
    <div className="diff-proposals-container">
      {proposals.map((proposal) => {
        const filePath = (proposal.params.file_path as string) || "file";
        const diffText = (proposal.params.diff as string) || (proposal.result as string) || "";

        return (
          <div key={proposal.id} className="diff-card">
            <div className="diff-header">
              <span className="diff-title">Proposal: Edit {filePath}</span>
              <span className={`diff-status status--${proposal.status || "pending"}`}>
                {proposal.status || "Pending confirmation"}
              </span>
            </div>
            {diffText && (
              <pre className="diff-content">
                {diffText.split("\n").map((line, idx) => {
                  const isAdd = line.startsWith("+");
                  const isDel = line.startsWith("-");
                  const lineNum = idx + 1;
                  return (
                    <span
                      key={idx}
                      className={isAdd ? "diff-line-add" : isDel ? "diff-line-del" : "diff-line"}
                    >
                      <span className="diff-line-num" aria-hidden="true">{lineNum}</span>
                      {line}
                      {"\n"}
                    </span>
                  );
                })}
              </pre>
            )}
            {proposal.status === "pending" && onApprove && onReject && (
              <div className="diff-actions">
                <button
                  type="button"
                  className="diff-approve"
                  onClick={() => onApprove(proposal.id)}
                >
                  Apply Change
                </button>
                <button
                  type="button"
                  className="diff-reject"
                  onClick={() => onReject(proposal.id)}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
