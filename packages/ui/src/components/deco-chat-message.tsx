import { cn } from "../lib/utils.ts";
import { memo, useCallback, useMemo } from "react";
import { MemoizedMarkdown } from "./chat/chat-markdown.tsx";
import { Button } from "./button.tsx";
import { Icon } from "./icon.tsx";
import { useCopy } from "../hooks/use-copy.ts";
import type { UIMessage } from "ai";

export interface DecoChatMessageProps {
  message: UIMessage;
  isStreaming?: boolean;
  className?: string;
  timestamp?: string;
}

export const DecoChatMessage = memo(function DecoChatMessage({
  message,
  isStreaming,
  className,
  timestamp,
}: DecoChatMessageProps) {
  const { id, role } = message;

  // Extract content from either content field or parts array
  const content = useMemo(() => {
    if ("content" in message && typeof message.content === "string") {
      return message.content;
    }
    return (
      message.parts
        ?.map((p: { type: string; text?: string }) =>
          p.type === "text" ? p.text : "",
        )
        .join("") ?? ""
    );
  }, [message]);
  const { handleCopy } = useCopy();
  const isUser = role === "user";

  const formattedTimestamp = useMemo(() => {
    if (!timestamp)
      return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [timestamp]);

  const handleCopyMessage = useCallback(async () => {
    await handleCopy(content);
  }, [content, handleCopy]);

  return (
    <div
      className={cn(
        "w-full min-w-0 group relative flex items-start gap-4 px-4 z-20 text-foreground",
        isUser ? "flex-row-reverse py-4" : "flex-row",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-2 min-w-0",
          isUser ? "items-end max-w-3/4 ml-auto" : "w-full items-start",
        )}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formattedTimestamp}</span>
        </div>

        <div
          className={cn(
            "w-full min-w-0 not-only:rounded-2xl text-[0.9375rem] break-words overflow-wrap-anywhere",
            isUser ? "bg-muted px-4 py-3" : "bg-transparent",
          )}
        >
          {content ? (
            isUser ? (
              <div className="whitespace-pre-wrap">{content}</div>
            ) : (
              <MemoizedMarkdown
                messageId={id}
                part={{
                  type: "text",
                  text: content,
                  state: isStreaming ? "streaming" : "done",
                }}
              />
            )
          ) : !isUser && isStreaming ? (
            <TypingIndicator />
          ) : (
            <span className="text-muted-foreground">Thinking...</span>
          )}

          {!isUser && content && (
            <div className="mt-2 flex w-full min-h-[28px] items-center justify-end gap-2 text-xs text-muted-foreground opacity-0 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto">
              <div className="flex gap-1">
                <Button
                  onClick={handleCopyMessage}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground px-2 py-1 h-auto whitespace-nowrap"
                >
                  <Icon name="content_copy" className="mr-1 text-sm" />
                  Copy message
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

function TypingIndicator() {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <span className="size-2 rounded-full bg-muted-foreground/80 animate-bounce [animation-delay:-0.2s]" />
      <span className="size-2 rounded-full bg-muted-foreground/80 animate-bounce [animation-delay:-0.05s]" />
      <span className="size-2 rounded-full bg-muted-foreground/80 animate-bounce" />
    </span>
  );
}
