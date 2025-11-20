import { create } from "zustand";
import type { UIMessage } from "@ai-sdk/react";

interface ChatStore {
  sendMessage: ((message: UIMessage) => Promise<void>) | null;
  setSendMessage: (
    sendMessage: ((message: UIMessage) => Promise<void>) | null,
  ) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  sendMessage: null,
  setSendMessage: (sendMessage) => set({ sendMessage }),
}));
