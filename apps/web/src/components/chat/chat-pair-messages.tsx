import type { UIMessage } from "@ai-sdk/react";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { cn } from "@deco/ui/lib/utils.ts";
import { useThread } from "../decopilot/thread-provider.tsx";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
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
  const internalRef = useRef<HTMLDivElement>(null);
  const { tabs } = useThread();
  const hasTabs = tabs.length > 0;

  useImperativeHandle(ref, () => internalRef.current as HTMLDivElement);

  const handleScrollToPair = () => {
    if (internalRef.current) {
      internalRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <div ref={internalRef} className="flex flex-col">
      <div
        onClick={handleScrollToPair}
        className={cn(
          "message-block sticky top-0 z-50 px-4 pt-2 transition-all duration-500 ease-out cursor-pointer bg-sidebar",
          !hasTabs && "bg-background"
        )}
      >
        <UserMessage message={user} onScrollToMessage={handleScrollToPair} />
      </div>

      <div className="message-block px-4 py-4">
        <AssistentChatMessage message={assistant} isLastMessage={isLastPair} />
      </div>
    </div>
  );
});
