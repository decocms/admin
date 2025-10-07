import type { Message } from "ai";

export function hasPdf(messages: Message[]) {
  return messages.some((message) =>
    message.experimental_attachments?.some(
      (attachment) => attachment.contentType === "application/pdf",
    ),
  );
}
