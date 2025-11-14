import type { UIMessage } from "@ai-sdk/react";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { cn } from "@deco/ui/lib/utils.ts";
import { useThread } from "../decopilot/thread-provider.tsx";
import { UserMessage } from "./user-message.tsx";
import { AssistantChatMessage } from "./assistant-chat-message.tsx";

interface ChatAskAnswerPairProps {
  user: UIMessage;
  assistant?: UIMessage;
  isLastPair?: boolean;
}

export interface ChatAskAnswerPairHandle {
  scrollToPair: () => void;
  getElement: () => HTMLDivElement | null;
}

export const ChatAskAnswerPair = forwardRef<
  ChatAskAnswerPairHandle,
  ChatAskAnswerPairProps
>(function ChatAskAnswerPair({ user, assistant, isLastPair }, ref) {
  const internalRef = useRef<HTMLDivElement>(null);
  const { tabs } = useThread();
  const hasTabs = tabs.length > 0;

  const handleScrollToPair = () => {
    if (internalRef.current) {
      internalRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  useImperativeHandle(ref, () => ({
    scrollToPair: handleScrollToPair,
    getElement: () => internalRef.current,
  }));

  return (
    <div ref={internalRef} className="flex flex-col">
      <div
        onClick={handleScrollToPair}
        className={cn(
          "message-block sticky top-0 z-50 px-4 pt-2 transition-all duration-500 ease-out cursor-pointer bg-sidebar",
          !hasTabs && "bg-background",
        )}
      >
        <UserMessage message={user} />
      </div>

      <div className="message-block px-4 py-4">
        <AssistantChatMessage hasTabs={hasTabs} message={assistant} isLastMessage={isLastPair} />
      </div>
    </div>
  );
});
