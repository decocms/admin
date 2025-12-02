import type { UIMessage } from "ai";
import { memo, useCallback, useMemo } from "react";
import { useCopy } from "../hooks/use-copy.ts";
import { cn } from "../lib/utils.ts";
import { Avatar } from "./avatar.tsx";
import { Button } from "./button.tsx";
import { MemoizedMarkdown } from "./chat/chat-markdown.tsx";
import { Icon } from "./icon.tsx";
import { Metadata } from "../types/chat-metadata.ts";

export interface DecoChatMessageProps<T extends Metadata> {
  message: UIMessage<T>;
  status?: "streaming" | "submitted" | "ready" | "error";
  className?: string;
}

export const DecoChatMessage = memo(function DecoChatMessage<
  T extends Metadata,
>({ message, status, className }: DecoChatMessageProps<T>) {
  const {
    id,
    role,
    metadata: { user, agent, created_at } = {},
  } = message;

  const user_avatar = user?.avatar;
  const user_name = user?.name;
  const agent_avatar = agent?.avatar;
  const agent_name = agent?.title;

  // Extract content from either content field or parts array
  const content = useMemo(() => {
    if ("content" in message && typeof message.content === "string") {
      return message.content;
    }
    return (
      message.parts
        ?.map(
          (p: { type: string; text?: string }) =>
            (p.type === "text" ? p.text : "") ?? "",
        )
        .join("") ?? ""
    );
  }, [message]);
  const { handleCopy } = useCopy();
  const isUser = role === "user";

  const formattedTimestamp = useMemo(() => {
    const date = created_at ? new Date(created_at) : new Date();
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [created_at]);

  const handleCopyMessage = useCallback(async () => {
    await handleCopy(content);
  }, [content, handleCopy]);

  const isStreaming = status === "streaming";
  const isSubmitted = status === "submitted";
  const isLoading = isStreaming || isSubmitted;

  return (
    <div
      className={cn(
        "w-full min-w-0 group relative flex items-start gap-4 px-4 z-20 text-foreground",
        isUser ? "flex-row-reverse py-4" : "flex-row",
        className,
      )}
    >
      <Avatar
        url={isUser ? user_avatar : agent_avatar}
        fallback={isUser ? user_name || "U" : agent_name || "A"}
        shape={isUser ? "circle" : "square"}
        size="sm"
        className="mt-0.5 shrink-0"
      />

      <div
        className={cn(
          "flex flex-col gap-2 min-w-0",
          isUser ? "items-end max-w-3/4" : "w-full items-start",
        )}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {isUser ? user_name || "You" : agent_name || "Agent"}
          </span>
          <span>{formattedTimestamp}</span>
        </div>

        <div
          className={cn(
            "w-full min-w-0 not-only:rounded-2xl text-[0.9375rem] wrap-break-word overflow-wrap-anywhere",
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
          ) : !isUser && isLoading ? (
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
