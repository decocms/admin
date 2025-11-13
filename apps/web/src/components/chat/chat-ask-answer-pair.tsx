import type { UIMessage } from "@ai-sdk/react";
import { forwardRef } from "react";
import { UserMessage } from "./user-message.tsx";
import { AssistentChatMessage } from "./assistent-chat-message.tsx";

interface ChatAskAnswerPairProps {
  user: UIMessage;
  assistant?: UIMessage;
  isLastPair?: boolean;
}

export const ChatAskAnswerPair = forwardRef<
  HTMLDivElement,
  ChatAskAnswerPairProps
>(function ChatAskAnswerPair({ user, assistant, isLastPair }, ref) {
  const handleScrollToPair = () => {
    if (ref && typeof ref !== "function" && ref.current) {
      ref.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <div ref={ref} className="flex flex-col">
      <div
        onClick={handleScrollToPair}
        className="message-block sticky top-0 z-50 px-4 pt-2 transition-all duration-500 ease-out cursor-pointer"
      >
        <UserMessage message={user} onScrollToMessage={handleScrollToPair} />
      </div>

      <div className="message-block px-4 py-4">
        <AssistentChatMessage message={assistant} isLastMessage={isLastPair} />
      </div>
    </div>
  );
});
