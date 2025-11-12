import type { UIMessage } from "@ai-sdk/react";
import { useRef } from "react";
import { UserMessage } from "./user-message.tsx";
import { AssistentChatMessage } from "./assistent-chat-message.tsx";

interface ChatAskAnswerPairProps {
  user: UIMessage;
  assistant?: UIMessage;
  isLastPair?: boolean;
}

export function ChatAskAnswerPair({
  user,
  assistant,
  isLastPair,
}: ChatAskAnswerPairProps) {
  const pairRef = useRef<HTMLDivElement>(null);

  const handleScrollToPair = () => {
    if (pairRef.current) {
      pairRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <div ref={pairRef} className="flex flex-col">
      <div
        onClick={handleScrollToPair}
        className="message-block sticky top-0 z-50 bg-background px-4 pt-2 transition-all duration-500 ease-out cursor-pointer"
      >
        <UserMessage
          message={user}
          onScrollToMessage={handleScrollToPair}
        />
      </div>

      <div className="message-block bg-background px-4 py-4">
        <AssistentChatMessage message={assistant} isLastMessage={isLastPair} />
      </div>
    </div>
  );
}
