/**
 * Code generated from https://github.com/mastra-ai/mastra/blob/7d8b7c78e61a96f0caf98e87f8c4d2b343995cbd/packages/core/src/memory/memory.ts#L532
 */

import type {
  AssistantContent,
  CoreToolMessage,
  Message,
  ToolContent,
  ToolInvocation,
  ToolResultPart,
  UserContent,
} from "ai";

// Types for the memory system
export type MessageType = {
  id: string;
  content: UserContent | AssistantContent | ToolContent;
  role: "system" | "user" | "assistant" | "tool";
  createdAt: Date;
  threadId: string;
  resourceId: string;
  toolCallIds?: string[];
  toolCallArgs?: Record<string, unknown>[];
  toolNames?: string[];
  type: "text" | "tool-call" | "tool-result";
};

function addToolMessageToChat({
  toolMessage,
  messages,
  toolResultContents,
}: {
  toolMessage: CoreToolMessage;
  messages: Message[];
  toolResultContents: ToolResultPart[];
}): {
  chatMessages: Message[];
  toolResultContents: ToolResultPart[];
} {
  const chatMessages = messages.map((message) => {
    if (message.toolInvocations) {
      return {
        ...message,
        toolInvocations: message.toolInvocations.map((toolInvocation) => {
          const toolResult = toolMessage.content.find((tool) =>
            tool.toolCallId === toolInvocation.toolCallId
          );

          if (toolResult) {
            return {
              ...toolInvocation,
              state: "result",
              result: toolResult.result,
            };
          }

          return toolInvocation;
        }),
      };
    }

    return message;
  }) as Message[];

  const resultContents = [...toolResultContents, ...toolMessage.content];

  return { chatMessages, toolResultContents: resultContents };
}

export function convertToUIMessages(messages: MessageType[]): Message[] {
  const { chatMessages } = messages.reduce(
    (acc, curr) => {
      if (curr.role === "tool") {
        return addToolMessageToChat({
          toolMessage: curr as unknown as CoreToolMessage,
          messages: acc.chatMessages,
          toolResultContents: acc.toolResultContents,
        });
      }

      let textContent = "";
      const toolInvocations: ToolInvocation[] = [];

      // When we safeParse a user message that MIGHT be valid json for coincidence,
      // we force it to be a formatted json string. Only messages we expect to be json
      // are those from the assistant/tools.
      if (curr.role === "user" && typeof curr.content !== "string") {
        textContent = `\`\`\`json\n${JSON.stringify(curr.content, null, 2)}`;
      } else if (typeof curr.content === "string") {
        textContent = curr.content;
      } else if (typeof curr.content === "number") {
        textContent = String(curr.content);
      } else if (Array.isArray(curr.content)) {
        for (const content of curr.content) {
          if (content.type === "text") {
            textContent += content.text;
          } else if (content.type === "tool-call") {
            const toolResult = acc.toolResultContents.find((tool) =>
              tool.toolCallId === content.toolCallId
            );
            toolInvocations.push({
              state: toolResult ? "result" : "call",
              toolCallId: content.toolCallId ?? "",
              toolName: content.toolName ?? "",
              args: content.args,
              result: toolResult?.result,
            });
          }
        }
      }

      acc.chatMessages.push({
        id: (curr as MessageType).id,
        role: curr.role as Message["role"],
        content: textContent,
        toolInvocations,
        createdAt: new Date(curr.createdAt),
      });

      return acc;
    },
    { chatMessages: [], toolResultContents: [] } as {
      chatMessages: Message[];
      toolResultContents: ToolResultPart[];
    },
  );

  return chatMessages;
}
