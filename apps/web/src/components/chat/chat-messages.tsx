import { cn } from "@deco/ui/lib/utils.ts";
import { useMemo, useRef } from "react";
import { useAgenticChat } from "../chat/provider.tsx";
import { ChatAskAnswerPair } from "./chat-ask-answer-pair.tsx";
import { ChatError } from "./chat-error.tsx";
import { ChatFinishReason } from "./chat-finish-reason.tsx";
import { EmptyState } from "./empty-state.tsx";
import { groupMessagesInPairs } from "./utils/format-ask-answer-messages.ts";

interface ChatMessagesProps {
  className?: string;
}

export function ChatMessages({ className }: ChatMessagesProps = {}) {
  const lastPairRef = useRef<HTMLDivElement | null>(null);
  const {
    chat: { messages, status },
  } = useAgenticChat();

  const messagePairs = useMemo(
    () => groupMessagesInPairs(messages),
    [messages],
  );

  return (
    <div
      className={cn("w-full min-w-0 max-w-full overflow-visible", className)}
    >
      {messagePairs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col min-w-0 max-w-2xl mx-auto w-full">
          {messagePairs.map((pair, index) => {
            const isLastPair = messagePairs.length === index + 1;
            return (
              <ChatAskAnswerPair
                key={pair.user.id}
                user={pair.user}
                assistant={pair.assistant}
                isLastPair={isLastPair}
                ref={isLastPair ? lastPairRef : undefined}
              />
            );
          })}
          <ChatError />
          <div className="px-4">
            <ChatFinishReason />
          </div>
        </div>
      )}

      <div
        key={messages.length}
        ref={(el) => {
          if (!el) return;

          const isFirstMount = !lastPairRef.current;
          const shouldScroll = status === "submitted" || isFirstMount;

          if (!shouldScroll) {
            return;
          }

          if (lastPairRef.current) {
            lastPairRef.current.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }}
      />
    </div>
  );
}
