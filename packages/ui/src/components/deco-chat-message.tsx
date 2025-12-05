import type { UIMessage } from "ai";
import { type PropsWithChildren, useMemo } from "react";
import { cn } from "../lib/utils.ts";
import { Metadata } from "../types/chat-metadata.ts";
import { Avatar } from "./avatar.tsx";
import { DecoChatMessageReasoningPart } from "./chat/parts/deco-chat-message-reasoning-part.tsx";
import { DecoChatMessageTextPart } from "./chat/parts/deco-chat-message-text-part.tsx";

export interface DecoChatMessageProps<T extends Metadata> {
  message: UIMessage<T>;
  status?: "streaming" | "submitted" | "ready" | "error";
  className?: string;
}

export function DecoChatMessageFooter({ children }: PropsWithChildren) {
  return <>{children}</>;
}

function useTimestamp(created_at: string | Date) {
  return useMemo(
    () =>
      new Date(created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [created_at],
  );
}

function TypingIndicator() {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <span className="size-2 rounded-full bg-muted-foreground/80 animate-bounce [animation-delay:-0.2s]" />
      <span className="size-2 rounded-full bg-muted-foreground/80 animate-bounce [animation-delay:-0.05s]" />
      <span className="size-2 rounded-full bg-muted-foreground/80 animate-bounce" />
    </span>
  );
}

export function DecoChatMessageUser<T extends Metadata>({
  message,
  className,
}: DecoChatMessageProps<T>) {
  const { id, parts, metadata: { user, created_at } = {} } = message;
  const formattedTimestamp = useTimestamp(
    created_at ?? new Date().toISOString(),
  );

  return (
    <div
      className={cn(
        "w-full min-w-0 group relative flex items-start gap-4 px-4 z-20 text-foreground flex-row-reverse py-4",
        className,
      )}
    >
      <Avatar
        url={user?.avatar}
        fallback={user?.name || "U"}
        shape="circle"
        size="sm"
        className="mt-0.5 shrink-0"
      />

      <div className="flex flex-col gap-2 min-w-0 items-end max-w-3/4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {user?.name || "You"}
          </span>
          <span>{formattedTimestamp}</span>
        </div>

        <div className="w-full min-w-0 not-only:rounded-2xl text-[0.9375rem] wrap-break-word overflow-wrap-anywhere bg-muted px-4 py-3">
          {parts.map((part, index) => {
            if (part.type === "text") {
              return (
                <DecoChatMessageTextPart
                  key={`${id}-${index}`}
                  id={id}
                  text={part.text}
                />
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}

export function DecoChatMessageAssistant<T extends Metadata>({
  message,
  status,
  className,
}: DecoChatMessageProps<T>) {
  const { id, parts, metadata: { agent, created_at } = {} } = message;
  const formattedTimestamp = useTimestamp(
    created_at ?? new Date().toISOString(),
  );

  const isStreaming = status === "streaming";
  const isSubmitted = status === "submitted";
  const isLoading = isStreaming || isSubmitted;

  return (
    <div
      className={cn(
        "w-full min-w-0 group relative flex items-start gap-4 px-4 z-20 text-foreground flex-row",
        className,
      )}
    >
      <Avatar
        url={agent?.avatar}
        fallback={agent?.title || "A"}
        shape="square"
        size="sm"
        className="mt-0.5 shrink-0"
      />

      <div className="flex flex-col gap-2 min-w-0 w-full items-start">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {agent?.title || "Agent"}
          </span>
          <span>{formattedTimestamp}</span>
        </div>

        <div className="w-full min-w-0 not-only:rounded-2xl text-[0.9375rem] wrap-break-word overflow-wrap-anywhere bg-transparent">
          {parts.length > 0 ? (
            parts.map((part, index) => {
              if (part.type === "text") {
                return (
                  <DecoChatMessageTextPart
                    key={`${id}-${index}`}
                    id={id}
                    text={part.text}
                    copyable={true}
                  />
                );
              }
              if (part.type === "reasoning") {
                return (
                  <DecoChatMessageReasoningPart
                    key={`${id}-${index}`}
                    part={part}
                    id={id}
                  />
                );
              }
              return null;
            })
          ) : isLoading ? (
            <TypingIndicator />
          ) : null}
        </div>
      </div>
    </div>
  );
}
