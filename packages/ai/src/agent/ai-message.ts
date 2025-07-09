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
  // TEMP LOG: Message conversion start
  console.log("🔄 [TEMP] Converting message:", {
    messageId: "id" in message ? message.id : "no-id",
    messageType: isAudioMessage(message) ? "audio" : "text",
    hasContent: "content" in message,
    hasAudioBase64: "audioBase64" in message,
    messageKeys: Object.keys(message)
  });

  if (isAudioMessage(message)) {
    if (!agent) {
      throw new Error("Agent is required for audio messages");
    }
    const transcription = await transcribeBase64Audio({
      audio: message.audioBase64,
      agent,
    });

    // TEMP LOG: Audio message converted
    console.log("🔄 [TEMP] Audio message converted to text:", {
      originalMessageId: message.id,
      transcription: transcription,
      transcriptionLength: transcription.length
    });

    return {
      role: "user",
      id: crypto.randomUUID(),
      content: transcription,
    };
  }
  return message;
}
