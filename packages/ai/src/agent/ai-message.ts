import type { Message as AIMessage } from "../types.ts";
import type { Message } from "ai";
import { isAudioMessage, transcribeBase64Audio } from "./audio.ts";
import type { Agent as MastraAgent } from "@mastra/core/agent";
import type { Workspace } from "@deco/sdk/path";
import type { AIAgent } from "../agent.ts";

const isPartsMessage = (message: AIMessage) => {
  return "parts" in message && Array.isArray(message.parts) &&
    message.parts.length > 0;
};

export async function convertToAIMessage({
  message,
  agent,
  aiAgent,
}: {
  message: AIMessage;
  agent: MastraAgent;
  workspace: Workspace;
  aiAgent?: AIAgent;
}): Promise<Message> {
  if (isAudioMessage(message)) {
    const transcription = await transcribeBase64Audio({
      audio: message.audioBase64,
      agent,
    });

    return {
      role: "user",
      id: crypto.randomUUID(),
      content: transcription,
    };
  }
  if (isPartsMessage(message) && !message.content) {
    return {
      ...message,
      content: await Promise.all(
        message.parts
          ?.map(async (part) => {
            if (part.type === "text") {
              return part.text;
            }
            if ((part as unknown as { type: "image" }).type === "image") {
              const imagePath = (part as unknown as { image: string }).image;

              if (!aiAgent?.metadata?.mcpClient) {
                return null;
              }

              const result = await aiAgent.metadata.mcpClient.FS_READ({
                path: imagePath,
              });
              return `![image](${result.url})`;
            }
          })
          .filter(Boolean) || [],
      ).then((results) => results.join("\n")) ?? message.content ?? "",
    };
  }
  return message;
}
