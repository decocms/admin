import type { UIMessage } from "@ai-sdk/react";
import { useCallback, useMemo } from "react";
import { useCopy } from "../../hooks/use-copy.ts";
import { isImageMediaType } from "../../utils/mime-types.ts";
import type { MessageAttachment } from "./message-attachments.tsx";

interface UseMessageContentOptions {
  message?: UIMessage;
  fallbackToMessageContent?: boolean;
}

export function useMessageContent({
  message,
  fallbackToMessageContent = false,
}: UseMessageContentOptions) {
  const { handleCopy: copyContent } = useCopy();

  const attachments = useMemo(
    () =>
      message?.parts
        ?.filter((part) => part.type === "file")
        .filter((part) => !isImageMediaType(part.mediaType))
        .map((part) => ({
          contentType: part.mediaType,
          url: part.url,
          name: part.filename,
        })) as MessageAttachment[] | undefined,
    [message?.parts],
  );

  const textContent = useMemo(() => {
    if (message?.parts) {
      return message.parts
        .filter((part) => part.type === "text" && "text" in part)
        .map((part) =>
          part.type === "text" && "text" in part ? part.text : "",
        )
        .join("\n");
    }

    if (
      fallbackToMessageContent &&
      message &&
      "content" in message &&
      typeof message.content === "string"
    ) {
      return message.content;
    }

    return "";
  }, [message?.parts, message, fallbackToMessageContent]);

  const handleCopyMessage = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await copyContent(textContent);
    },
    [textContent, copyContent],
  );

  const hasTextContent = useMemo(() => {
    const hasPartsText = message?.parts?.some((part) => part.type === "text");

    if (fallbackToMessageContent) {
      return (
        hasPartsText ||
        (message && "content" in message && typeof message.content === "string")
      );
    }

    return hasPartsText ?? false;
  }, [message?.parts, message, fallbackToMessageContent]);

  return {
    attachments,
    textContent,
    handleCopyMessage,
    hasTextContent,
  };
}

