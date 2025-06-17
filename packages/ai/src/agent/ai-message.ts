import type { Message as AIMessage } from "../types.ts";
import type { Message } from "ai";
import { isAudioMessage, transcribeBase64Audio } from "./audio.ts";
import type { Agent as MastraAgent } from "@mastra/core/agent";

const isPartsMessage = (message: AIMessage) => {
  return "parts" in message && Array.isArray(message.parts) &&
    message.parts.length > 0;
};

export async function convertToAIMessage({
  message,
  agent,
}: {
  message: AIMessage;
  agent: MastraAgent;
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
      content: message.parts
        ?.map((part) => part.type === "text" ? part.text : null)
        .filter(Boolean)
        .join("\n") ?? message.content ?? "",
    };
  }
  return message;
}
