import type { UIMessage } from "@ai-sdk/react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useCallback, useMemo } from "react";
import { MemoizedMarkdown } from "./chat-markdown.tsx";
import { ReasoningPart } from "./reasoning-part";
import { ToolMessage } from "./tool-message.tsx";
import { useAgenticChat } from "./provider.tsx";
import { useCopy } from "../../hooks/use-copy.ts";
import { isImageMediaType } from "../../utils/mime-types.ts";
import {
  type MessageAttachment,
  ImagePart,
  AttachmentCard,
  isToolPart,
} from "./message-attachments.tsx";

interface ChatMessageProps {
  message?: UIMessage;
  isLastMessage?: boolean;
}

function Dots() {
  return (
    <div className="animate-in slide-in-from-bottom duration-300 flex items-center gap-2 text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="animate-bounce [animation-delay:-0.3s]">.</span>
        <span className="animate-bounce [animation-delay:-0.2s]">.</span>
        <span className="animate-bounce [animation-delay:-0.1s]">.</span>
      </span>
    </div>
  );
}

export function AssistentChatMessage({
  message,
  isLastMessage,
}: ChatMessageProps) {
  const { chat } = useAgenticChat();
  const { status } = chat;
  const { handleCopy: copyContent } = useCopy();

  const showDots =
    isLastMessage &&
    !message?.parts &&
    (status === "streaming" || status === "submitted");

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
    return "";
  }, [message?.parts]);

  const handleCopyMessage = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await copyContent(textContent);
    },
    [textContent, copyContent],
  );

  const hasTextContent = useMemo(() => {
    return message?.parts?.some((part) => part.type === "text") ?? false;
  }, [message?.parts]);

  return (
    <div
      className={cn(
        "w-full transition-all duration-500 ease-out group",
        isLastMessage && "min-h-[65vh]",
      )}
    >
      {message?.parts ? (
        <div className="space-y-3 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
          {message?.parts.map((part, index) => {
            if (part.type === "reasoning") {
              return (
                <ReasoningPart
                  key={index}
                  part={part}
                  messageId={message.id}
                  index={index}
                />
              );
            } else if (part.type === "text") {
              return (
                <MemoizedMarkdown
                  key={index}
                  part={part}
                  messageId={message.id}
                />
              );
            } else if (
              part.type === "file" &&
              "mediaType" in part &&
              isImageMediaType(part.mediaType)
            ) {
              // Handle image files
              return <ImagePart part={part} key={index} />;
            } else if (part.type === "step-start") {
              // Step start parts are typically not rendered visually
              return null;
            } else if (isToolPart(part)) {
              // Handle individual tool parts
              return <ToolMessage key={index} part={part} />;
            }
            return null;
          })}

          {attachments && attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map(
                (attachment: MessageAttachment, index: number) => (
                  <AttachmentCard
                    key={`${message.id}-${index}`}
                    attachment={attachment}
                  />
                ),
              )}
            </div>
          )}

          {hasTextContent && (
            <div className="mt-2 flex w-full items-center justify-end gap-2 text-xs text-muted-foreground opacity-0 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto">
              <div>
                <Button
                  onClick={handleCopyMessage}
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground hover:text-foreground p-0 h-auto"
                >
                  <Icon name="content_copy" className="text-sm" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : showDots ? (
        <Dots />
      ) : null}
    </div>
  );
}
