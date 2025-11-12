import { UIMessage } from "@ai-sdk/react";

export function formatAskAnswerMessages(messages: UIMessage[]) {
  const pairs: Array<{ user: UIMessage; assistant?: UIMessage }> = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    if (message.role === "user") {
      const nextMessage = messages[i + 1];
      
      pairs.push({
        user: message,
        assistant:
          nextMessage?.role === "assistant" ? nextMessage : undefined,
      });
    }
  }

  return pairs;
}
