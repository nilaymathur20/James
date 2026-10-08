import React, { createContext, useContext, useReducer, type ReactNode } from "react";

export type Theme = "dark" | "light" | "amoled";

interface ShellState {
  theme: Theme;
  leftRailOpen: boolean;
  rightDrawerOpen: boolean;
  rightDrawerTab: "trace" | "files" | "audit";
  activeConversation: string | null;
  conversations: Array<{ id: string; title: string; updatedAt: string }>;
}

type ShellAction =
  | { type: "SET_THEME"; payload: Theme }
  | { type: "TOGGLE_LEFT_RAIL" }
  | { type: "TOGGLE_RIGHT_DRAWER" }
  | { type: "SET_RIGHT_DRAWER_TAB"; payload: ShellState["rightDrawerTab"] }
  | { type: "SET_ACTIVE_CONVERSATION"; payload: string | null }
  | { type: "SET_CONVERSATIONS"; payload: ShellState["conversations"] };

const initialState: ShellState = {
  theme: "dark",
  leftRailOpen: true,
  rightDrawerOpen: false,
  rightDrawerTab: "trace",
  activeConversation: null,
  conversations: [],
};

function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case "SET_THEME": return { ...state, theme: action.payload };
    case "TOGGLE_LEFT_RAIL": return { ...state, leftRailOpen: !state.leftRailOpen };
    case "TOGGLE_RIGHT_DRAWER": return { ...state, rightDrawerOpen: !state.rightDrawerOpen };
    case "SET_RIGHT_DRAWER_TAB": return { ...state, rightDrawerOpen: true, rightDrawerTab: action.payload };
    case "SET_ACTIVE_CONVERSATION": return { ...state, activeConversation: action.payload };
    case "SET_CONVERSATIONS": return { ...state, conversations: action.payload };
    default: return state;
  }
}

interface ShellContextValue {
  state: ShellState;
  dispatch: React.Dispatch<ShellAction>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(shellReducer, initialState);
  return (
    <ShellContext.Provider value={{ state, dispatch }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used within ShellProvider");
  return ctx;
}
