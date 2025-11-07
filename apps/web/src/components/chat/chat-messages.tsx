import { cn } from "@deco/ui/lib/utils.ts";
import { useRef } from "react";
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
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const {
    chat: { messages, status },
  } = useAgenticChat();

  return (
    <div className={cn("w-full min-w-0 max-w-full overflow-hidden", className)}>
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-6 min-w-0 max-w-3xl mx-auto w-full">
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

      <div
        key={messages.length}
        ref={(el) => {
          const hasUserInteraction =
            status === "streaming" || status === "submitted";
          const isFirstMount = !sentinelRef.current;
          const shouldScroll = hasUserInteraction || isFirstMount;

          if (!shouldScroll) {
            return;
          }

          sentinelRef.current = el;
          sentinelRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        }}
      />
    </div>
  );
}
