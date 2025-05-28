import type { Message as AIMessage } from "../types.ts";
import type { Message } from "ai";
import { isAudioMessage, transcribeBase64Audio } from "./audio.ts";
import type { Agent as MastraAgent } from "@mastra/core/agent";

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

  if (typeof message.content === "string" && message.content) {
    const filteredParts = message.parts?.filter((part) =>
      part.type !== "text"
    ) ?? [];
    message.parts = filteredParts.length > 0 ? filteredParts : undefined;
  }
  return message;
}
