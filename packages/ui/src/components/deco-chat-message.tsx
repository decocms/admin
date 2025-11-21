import type { ReactNode } from "react";
import { cn } from "../lib/utils.ts";

interface DecoChatMessageProps {
  role: "user" | "assistant" | "system";
  content: ReactNode;
  timestamp?: string;
  className?: string;
  isStreaming?: boolean;
}

export function DecoChatMessage({
  role,
  content,
  timestamp,
  className,
  isStreaming,
}: DecoChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex w-full gap-4 px-4 py-2",
        isUser ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-2 min-w-0",
          isUser ? "items-end max-w-3/4 ml-auto" : "w-full items-start",
        )}
      >
        {timestamp && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{timestamp}</span>
          </div>
        )}
        <div
          className={cn(
            "w-full min-w-0 rounded-2xl text-[0.9375rem] break-words overflow-wrap-anywhere",
            isUser ? "bg-muted px-4 py-3" : "bg-transparent",
          )}
        >
          {content || (isStreaming && <TypingIndicator />)}
        </div>
      </div>
    </div>
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
