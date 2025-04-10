import { type Message, useChat } from "@ai-sdk/react";
import { Agent, API_SERVER_URL, useAgentRoot } from "@deco/sdk";
import { openPreviewPanel } from "../utils/preview.ts";
import { togglePanel } from "../../agent/index.tsx";
import { parseHandoffTool } from "../utils/parse.ts";

interface UseAgentChatProps {
  agent?: Agent;
  threadId?: string;
  initialMessages?: Message[];
  onError?: (error: Error) => void;
}

export function useAgentChat({ agent, threadId, initialMessages = [], onError }: UseAgentChatProps) {
  const agentRoot = useAgentRoot(agent?.id ?? "");

  return useChat({
    initialMessages,
    credentials: "include",
    headers: {
      "x-deno-isolate-instance-id": agentRoot,
    },
    api: new URL("/actors/AIAgent/invoke/stream", API_SERVER_URL).href,
    experimental_prepareRequestBody: ({ messages }: { messages: Message[] }) => ({
      args: [[messages.at(-1)]],
      metadata: {
        threadId: threadId ?? agent?.id ?? "",
      },
    }),
    onError: (error: Error) => {
      console.error("Chat error:", error);
      onError?.(error);
    },
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "RENDER") {
        const { content, title } = toolCall.args;
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
  });
} 