import { UIMessage } from "@ai-sdk/react";

export function formatAskAnswerMessages(messages: UIMessage[]) {
  return messages.reduce(
    (acc, message, index) => {
      if (message.role === "user") {
        const nextMessage = messages[index + 1];

        acc.push({
          user: message,
          assistant:
            nextMessage?.role === "assistant" ? nextMessage : undefined,
        });
      }
      return acc;
    },
    [] as Array<{ user: UIMessage; assistant?: UIMessage }>,
  );
}
