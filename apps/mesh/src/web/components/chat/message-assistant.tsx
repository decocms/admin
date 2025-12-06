import { Avatar } from "@deco/ui/components/avatar.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Metadata } from "@deco/ui/types/chat-metadata.ts";
import type { ToolUIPart } from "ai";
import { useMemo } from "react";
import { MessageProps } from "./message-user.tsx";
import { MessageReasoningPart } from "./parts/reasoning-part.tsx";
import { MessageTextPart } from "./parts/text-part.tsx";
import { ToolCallPart } from "./parts/tool-call-part.tsx";

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

export function MessageAssistant<T extends Metadata>({
  message,
  status,
  className,
}: MessageProps<T>) {
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
                  <MessageTextPart
                    key={`${id}-${index}`}
                    id={id}
                    text={part.text}
                    copyable={true}
                  />
                );
              }
              if (part.type === "reasoning") {
                return (
                  <MessageReasoningPart
                    key={`${id}-${index}`}
                    part={part}
                    id={id}
                  />
                );
              }
              if (part.type.startsWith("tool-")) {
                return (
                  <ToolCallPart
                    key={`${id}-${index}`}
                    part={part as ToolUIPart}
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
