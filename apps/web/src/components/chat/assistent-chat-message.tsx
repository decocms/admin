import { UIMessage } from "@ai-sdk/react";
import { cn } from "@deco/ui/lib/utils.ts";
import { ReasoningPart } from "./reasoning-part";
import { MemoizedMarkdown } from "./chat-markdown.tsx";
import { useAgenticChat } from "./provider.tsx";

interface ChatMessageProps {
  message?: UIMessage;
  isLastMessage?: boolean;
}

function Dots() {
  return (
    <div className="animate-in slide-in-from-bottom duration-300 flex items-center gap-2 text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="animate-bounce [animation-delay:-0.3s]">.</span>
        <span className="animate-bounce [animation-delay:-0.2s]">.</span>
        <span className="animate-bounce [animation-delay:-0.1s]">.</span>
      </span>
    </div>
  );
}

export function AssistentChatMessage({
  message,
  isLastMessage,
}: ChatMessageProps) {
  console.log("isLastMessage", isLastMessage);
  console.log("message", message);
  const { chat } = useAgenticChat();
  const { status } = chat;

  const showDots =
    isLastMessage &&
    !message?.parts &&
    (status === "streaming" || status === "submitted");

  return (
    <div
      className={cn(
        "w-full transition-all duration-500 ease-out",
        isLastMessage && "min-h-[68vh]",
      )}
    >
      {message?.parts ? (
        <div className="space-y-3 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
          {message?.parts.map((part, index) => {
            if (part.type === "reasoning") {
              return (
                <ReasoningPart
                  key={index}
                  part={part}
                  messageId={message.id}
                  index={index}
                />
              );
            } else if (part.type === "text") {
              return (
                <MemoizedMarkdown
                  key={index}
                  part={part}
                  messageId={message.id}
                />
              );
            }
            return null;
          })}
        </div>
      ) : showDots ? (
        <Dots />
      ) : null}
    </div>
  );
}
