import React, { createContext, useContext, useReducer, type ReactNode } from "react";
import type { ChatMessage, FileCandidate, ToolCallProposal } from "@/types";

interface MessageState {
  messages: ChatMessage[];
  fileCandidates: FileCandidate[];
  proposals: ToolCallProposal[];
}

type MessageAction =
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "SET_MESSAGES"; payload: ChatMessage[] }
  | { type: "SET_FILE_CANDIDATES"; payload: FileCandidate[] }
  | { type: "SET_PROPOSALS"; payload: ToolCallProposal[] }
  | { type: "UPDATE_PROPOSAL"; payload: { id: string; status: ToolCallProposal["status"] } }
  | { type: "CLEAR" };

function messageReducer(state: MessageState, action: MessageAction): MessageState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "SET_MESSAGES":
      return { ...state, messages: action.payload };
    case "SET_FILE_CANDIDATES":
      return { ...state, fileCandidates: action.payload };
    case "SET_PROPOSALS":
      return { ...state, proposals: action.payload };
    case "UPDATE_PROPOSAL":
      return {
        ...state,
        proposals: state.proposals.map((p) =>
          p.id === action.payload.id ? { ...p, status: action.payload.status } : p
        ),
      };
    case "CLEAR":
      return { messages: [], fileCandidates: [], proposals: [] };
    default:
      return state;
  }
}

interface MessageStoreContextValue {
  state: MessageState;
  dispatch: React.Dispatch<MessageAction>;
}

const MessageStoreContext = createContext<MessageStoreContextValue | null>(null);

export function MessageStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(messageReducer, {
    messages: [],
    fileCandidates: [],
    proposals: [],
  });

  return (
    <MessageStoreContext.Provider value={{ state, dispatch }}>
      {children}
    </MessageStoreContext.Provider>
  );
}

export function useMessageStore(): MessageStoreContextValue {
  const ctx = useContext(MessageStoreContext);
  if (!ctx) {
    throw new Error("useMessageStore must be used within MessageStoreProvider");
  }
  return ctx;
}