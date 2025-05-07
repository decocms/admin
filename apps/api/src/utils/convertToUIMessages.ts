/**
 * Code generated inspired by https://github.com/mastra-ai/mastra/blob/7d8b7c78e61a96f0caf98e87f8c4d2b343995cbd/packages/core/src/memory/memory.ts#L532
 * and add some fixes.
 * 
 * Somehow I was not able to correctly type this. Maybe someone with more knowledge on the codebase with these types can fix it.
 * Maybe @camudo?
 */

import type {
  AssistantContent,
  Message,
  ToolContent,
  UserContent
} from "ai";

// Types for the memory system
// TODO: better type this
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

const toParts = (results: Map<string, unknown>) =>
// deno-lint-ignore no-explicit-any
(item: any): NonNullable<Message["parts"]>[number] => {
  if (item.type === "tool-call") {
    const result = results.get(item.toolCallId);

    return {
      type: "tool-invocation",
      toolInvocation: {
        state: result ? "result" : "call",
        toolCallId: item.toolCallId,
        toolName: item.toolName,
        args: item.args,
        result: result ?? undefined,
      },
    };
  }

  if (item.type === "reasoning") {
    return {
      ...item,
      reasoning: item.text,
    };
  }

  return item;
};

export function convertToUIMessages(messages: MessageType[]): Message[] {
  const toolResults = new Map<string, unknown>();

  for (const message of messages) {
    if (message.type !== "tool-result") {
      continue;
    }

    if (!Array.isArray(message.content)) {
      console.error("Not Implemented");
      continue;
    }

    for (const item of message.content) {
      if (item.type !== "tool-result") {
        console.error("Not Implemented");
        continue;
      }

      toolResults.set(item.toolCallId, item.result);
    }
  }

  const uiMessages: Message[] = [];

  for (const message of messages) {
    if (message.role !== "assistant" && message.role !== "user") {
      continue;
    }

    if (typeof message.content === "string") {
      uiMessages.push(message as unknown as Message);
    } else if (typeof message.content === "number") {
      uiMessages.push({
        ...message,
        content: String(message.content),
      } as unknown as Message);
    } else if (Array.isArray(message.content)) {
      uiMessages.push({
        ...message,
        content: "",
        parts: message.content.map(toParts(toolResults)),
      } as unknown as Message);
    } else if (message.role === "user") {
      uiMessages.push({
        ...message,
        content: `\`\`\`json\n${JSON.stringify(message.content, null, 2)}`,
      } as unknown as Message);
    }
  }

  return uiMessages;
}
