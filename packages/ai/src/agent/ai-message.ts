import type { Message as AIMessage } from "../types.ts";
import type { Message } from "ai";
import { isAudioMessage, transcribeBase64Audio } from "./audio.ts";
import type { Agent as MastraAgent } from "@mastra/core/agent";

export async function convertToAIMessage({
  message,
  agent,
}: {
  message: AIMessage;
  agent?: MastraAgent;
}): Promise<Message> {
  if (isAudioMessage(message)) {
    if (!agent) {
      throw new Error("Agent is required for audio messages");
    }
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
  return message;
}
