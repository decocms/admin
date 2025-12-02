import type { UIMessage } from "@ai-sdk/react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { memo, useMemo, useState } from "react";
import { MemoizedMarkdown } from "./chat-markdown.tsx";
import { ReasoningPart } from "./reasoning-part.tsx";
import { ToolMessage } from "./tool-message.tsx";
import { isImageMediaType } from "../../utils/mime-types.ts";
import {
  type MessageAttachment,
  ImagePart,
  AttachmentCard,
  isToolPart,
} from "./message-attachments.tsx";
import { useMessageContent } from "./use-message-content.ts";

interface UserMessageProps {
  message: UIMessage;
}

export const UserMessage = memo(function UserMessage({
  message,
}: UserMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { attachments, textContent, handleCopyMessage, hasTextContent } =
    useMessageContent({
      message,
      fallbackToMessageContent: true,
    });

  const isLongMessage = useMemo(() => {
    return textContent.length > 100;
  }, [textContent]);

  return (
    <div className="w-full group relative">
      <div className="flex flex-col gap-2 min-w-0 items-end ml-auto">
        <div className="w-full border min-w-0 shadow-[0_3px_6px_-1px_rgba(0,0,0,0.1)] rounded-lg text-[0.9375rem] break-words overflow-wrap-anywhere bg-muted px-4 pt-2 pb-1 cursor-pointer hover:bg-muted/80 transition-colors">
          <div
            className={cn(
              isLongMessage &&
                !isExpanded &&
                "overflow-hidden relative max-h-[60px]",
            )}
          >
            {message.parts ? (
              <div className="space-y-3 w-full">
                {message.parts.map((part, index) => {
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
              </div>
            ) : (
              <MemoizedMarkdown
                messageId={message.id}
                part={{
                  type: "text",
                  text:
                    "content" in message && typeof message.content === "string"
                      ? message.content || ""
                      : "",
                }}
              />
            )}
            {isLongMessage && !isExpanded && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted to-transparent pointer-events-none" />
            )}
          </div>

          {isLongMessage && (
            <div className="flex justify-center">
              <Button
                onClick={() => setIsExpanded(!isExpanded)}
                variant="ghost"
                size="xs"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Icon
                  name={isExpanded ? "expand_less" : "expand_more"}
                  className="text-sm"
                />
              </Button>
            </div>
          )}

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
            <div className="flex w-full items-center justify-end gap-2 text-xs text-muted-foreground opacity-0 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto">
              <div>
                <Button
                  onClick={handleCopyMessage}
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground hover:text-foreground p-0 h-auto absolute right-2 bottom-2"
                >
                  <Icon name="content_copy" className="text-sm" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
