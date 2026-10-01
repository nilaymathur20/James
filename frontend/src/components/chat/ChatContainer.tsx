import React, { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types";
import { MessageBubble } from "./MessageBubble";

interface ChatContainerProps {
  messages: ChatMessage[];
  sending: boolean;
  activity: string;
  onApproveProposal?: (proposalId: string) => void;
  onRejectProposal?: (proposalId: string) => void;
  onSpeakText?: (text: string) => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  sending,
  activity,
  onApproveProposal,
  onRejectProposal,
  onSpeakText,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, activity]);

  return (
    <section className="conversation" aria-label="Assistant conversation" aria-live="polite">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onApproveProposal={onApproveProposal}
          onRejectProposal={onRejectProposal}
          onSpeakText={onSpeakText}
        />
      ))}

      {sending && (
        <article className="message message--assistant" aria-label={activity || "Assistant is working"}>
          <div className="avatar" aria-hidden="true">J</div>
          <div className="message-body typing">
            <i /><i /><i />
            <span>{activity || "Working locally…"}</span>
          </div>
        </article>
      )}

      <div ref={bottomRef} />
    </section>
  );
};
