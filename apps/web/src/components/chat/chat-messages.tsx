import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useCallback, useRef, useState } from "react";
import { useAgenticChat } from "../chat/provider.tsx";
import { ChatError } from "./chat-error.tsx";
import { ChatFinishReason } from "./chat-finish-reason.tsx";
import { ChatMessage } from "./chat-message.tsx";
import { EmptyState } from "./empty-state.tsx";

interface ChatMessagesProps {
  className?: string;
}

function Dots() {
  const { chat } = useAgenticChat();
  const { status } = chat;

  if (status !== "streaming" && status !== "submitted") {
    return null;
  }

  return (
    <div className="animate-in slide-in-from-bottom duration-300 flex items-center gap-2 text-muted-foreground ml-4">
      <span className="inline-flex items-center gap-1">
        <span className="animate-bounce [animation-delay:-0.3s]">.</span>
        <span className="animate-bounce [animation-delay:-0.2s]">.</span>
        <span className="animate-bounce [animation-delay:-0.1s]">.</span>
      </span>
    </div>
  );
}

export function ChatMessages({ className }: ChatMessagesProps = {}) {
  const { chat } = useAgenticChat();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  // Single ref approach: sentinelRef is the only ref we keep

  const { messages, status } = chat;
  const isStreaming = status === "streaming" || status === "submitted";

  // Single-ref setup: we no longer measure container scroll; the sentinel
  // is used for scrollIntoView on send

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    sentinel.scrollIntoView({ behavior, block: "end" });
    setIsAtBottom(true);
    setShowScrollButton(false);
  }, [sentinelRef]);

  // No effect needed; sentinel ref handles scroll anchoring on mount

  // Ref-based auto-scroll: remount sentinel on message count change
  // so the callback runs without effects

  const isEmpty = messages.length === 0;

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full relative overflow-hidden",
        className,
      )}
    >
      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-6 min-w-0 max-w-full">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              isLastMessage={messages.length === index + 1}
            />
          ))}
          <ChatError />
          <div className="px-4">
            <ChatFinishReason />
          </div>
          <Dots />
        </div>
      )}

      {/* Scroll to bottom button - sticky at bottom of scroll area */}
      {messages.length > 0 &&
        showScrollButton &&
        !(isStreaming && isAtBottom) && (
          <div className="sticky bottom-0 left-0 right-0 flex justify-center pointer-events-none pb-4 z-100">
            <button
              type="button"
              className={cn(
                "w-10 h-10 rounded-full pointer-events-auto",
                "bg-background dark:bg-accent shadow-xl",
                "border border-border/50",
                "flex items-center justify-center",
                "cursor-pointer hover:scale-110 hover:shadow-2xl",
                "transition-all duration-200 ease-out",
                "animate-in fade-in slide-in-from-bottom-4 duration-150",
                "group",
              )}
              onClick={() => scrollToBottom("smooth")}
              aria-label="Scroll to bottom"
            >
              <Icon
                name="arrow_downward"
                className="text-foreground group-hover:text-primary transition-colors"
              />
            </button>
          </div>
        )}

      <div
        key={messages.length}
        ref={(el) => {
          // always update the shared ref
          // and scroll the nearest scrollable ancestor into view
          // when the sentinel mounts (on message count change)
          // avoiding effects
          sentinelRef.current = el;
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "end" });
          }
        }}
      />
    </div>
  );
}
