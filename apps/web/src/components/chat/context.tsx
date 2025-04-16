import { type Message, useChat } from "@ai-sdk/react";
import {
  API_SERVER_URL,
  useAgentRoot,
  useInvalidateAll,
  useMessages,
} from "@deco/sdk";
import { createContext, PropsWithChildren, useContext, useEffect } from "react";
import { openPreviewPanel } from "./utils/preview.ts";

type IContext = {
  agentId: string;
  threadId: string;
} & ReturnType<typeof useChat>;

const Context = createContext<IContext | null>(null);

export const useChatContext = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }

  return context;
};

interface Props {
  agentId: string;
  threadId: string;
  /**
   *  Message to display when no previous messages are present on the thread
   */
  initialMessages?: Message[];
}

const THREAD_TOOLS_INVALIDATION_TOOL_CALL = new Set([
  "DECO_INTEGRATION_INSTALL",
  "DECO_INTEGRATION_ENABLE",
  "DECO_INTEGRATION_DISABLE",
  "DECO_AGENT_CONFIGURE",
]);

export function ChatProvider({
  agentId,
  threadId,
  children,
  initialMessages: defaultInitialMessages,
}: PropsWithChildren<Props>) {
  const { data: initialMessages } = useMessages(agentId, threadId);
  const agentRoot = useAgentRoot(agentId);
  const invalidateThreadTools = useInvalidateAll(agentId, threadId);
  const chat = useChat({
    initialMessages,
    credentials: "include",
    headers: { "x-deno-isolate-instance-id": agentRoot },
    api: new URL("/actors/AIAgent/invoke/stream", API_SERVER_URL).href,
    experimental_prepareRequestBody: ({ messages }) => ({
      args: [[messages.at(-1)]],
      metadata: { threadId: threadId ?? agentId },
    }),
    onError: (error) => {
      console.error("Chat error:", error);
      chat.setMessages((prevMessages) => prevMessages.slice(0, -1));
    },
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "RENDER") {
        const { content, title } = toolCall.args as {
          content: string;
          title: string;
        };

        openPreviewPanel(
          `preview-${toolCall.toolCallId}`,
          content,
          title,
        );
        return {
          success: true,
        };
      }
    },
    onFinish: (message) => {
      message.toolInvocations?.forEach((toolInvocation) => {
        if (THREAD_TOOLS_INVALIDATION_TOOL_CALL.has(toolInvocation.toolName)) {
          invalidateThreadTools.mutate();
        }
      });
    },
  });

  useEffect(() => {
    if (initialMessages.length === 0 && defaultInitialMessages?.length) {
      defaultInitialMessages.forEach((message) => chat.append(message));
    }
  }, [initialMessages, defaultInitialMessages]);

  return (
    <Context.Provider value={{ agentId, threadId, ...chat }}>
      {children}
    </Context.Provider>
  );
}
