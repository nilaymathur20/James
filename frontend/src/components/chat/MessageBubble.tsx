import React from "react";
import type { ChatMessage } from "@/types";
import { SpeakerIcon, PhoneIcon } from "@/icons";
import { ThoughtStream } from "./ThoughtStream";
import { DiffViewer } from "./DiffViewer";
import { FileCandidates } from "../files/FileCandidates";

interface MessageBubbleProps {
  message: ChatMessage;
  onApproveProposal?: (proposalId: string) => void;
  onRejectProposal?: (proposalId: string) => void;
  onSpeakText?: (text: string) => void;
}

function formatKind(kind: string): string {
  const labels: Record<string, string> = {
    chat: "RAG answer",
    search: "Local search",
    index_folder: "Folder indexed",
    index_web: "Web source indexed",
    open_candidates: "Matching files",
    preview_candidates: "Preview candidates",
    edit_candidates: "Edit candidates",
    help: "Command help",
    clarification: "Need more detail",
  };
  return labels[kind] || kind.replaceAll("_", " ");
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onApproveProposal,
  onRejectProposal,
  onSpeakText,
}) => {
  const isUser = message.role === "user";

  return (
    <article className={`message message--${message.role}`} key={message.id}>
      <div className="avatar" aria-hidden="true">
        {isUser ? "You" : "J"}
      </div>

      <div className="message-body">
        <div className="message-meta">
          <strong>{isUser ? "You" : "James"}</strong>
          {message.kind && <span>{formatKind(message.kind)}</span>}
          <time>{message.time}</time>
          {!isUser && onSpeakText && message.content && (
            <button
              type="button"
              className="speak-button"
              onClick={() => onSpeakText(message.content)}
              title="Read aloud with local TTS"
              aria-label="Read message aloud"
            >
              <SpeakerIcon size={14} />
            </button>
          )}
        </div>

        <ThoughtStream steps={message.steps} thought={message.thought} />

        {message.content && <p>{message.content}</p>}

        {message.mediaUrl && message.mediaType === "image" && (
          <div className="message-media-image">
            <img src={message.mediaUrl} alt="Generated output" loading="lazy" />
          </div>
        )}

        {message.providerError && (
          <p className="provider-note">Generation note — no cloud fallback: {message.providerError}</p>
        )}

        <DiffViewer
          proposals={message.toolProposals}
          onApprove={onApproveProposal}
          onReject={onRejectProposal}
        />

        <FileCandidates candidates={message.fileCandidates} />

        {message.sources && message.sources.length > 0 && (
          <div className="sources" aria-label="Relevant sources">
            <span className="sources-title">Relevant sources</span>
            {message.sources.map((source, sourceIndex) => (
              <div
                className="source-card"
                key={`${message.id}-${source.source}-${source.chunk_index}-${sourceIndex}`}
              >
                <div className="source-card-top">
                  <span className={`source-type source-type--${source.source_type}`}>
                    {source.source_type === "history" ? "Past chat" : source.source_type}
                  </span>
                  {source.device_id && source.device_id !== "local" && (
                    <span className="device-origin-badge">
                      <PhoneIcon size={10} /> {source.device_id}
                    </span>
                  )}
                  <span className="score">
                    {Math.round(Number(source.score || 0) * 100)}% match
                  </span>
                </div>
                <strong title={source.source}>{source.source}</strong>
                {source.snippet && <p>{source.snippet}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
};