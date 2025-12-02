import { MemoizedMarkdown } from "@deco/ui/components/chat/chat-markdown.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useState } from "react";

interface ReasoningPartProps {
  part: {
    type: "reasoning";
    text: string;
    state?: "streaming" | "done";
  };
  messageId: string;
  index: number;
}

export function ReasoningPart({ part, index, messageId }: ReasoningPartProps) {
  const { state } = part;
  const isPartStreaming = state === "streaming";
  const [isExpanded, setIsExpanded] = useState(false);
  const [wasManuallyExpanded, setWasManuallyExpanded] = useState(false);

  // Handle automatic expansion/collapse based on streaming states
  useEffect(() => {
    if (wasManuallyExpanded) return; // Don't auto-collapse if user manually expanded

    if (isPartStreaming) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [isPartStreaming, wasManuallyExpanded]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    setWasManuallyExpanded(!isExpanded);
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 py-2 transition-colors cursor-pointer"
      >
        <Icon
          name="psychology"
          className={cn(
            "text-muted-foreground transition-opacity",
            isPartStreaming && "animate-pulse",
          )}
        />
        <span
          className={cn(
            "text-sm font-medium text-muted-foreground",
            isPartStreaming && "text-shimmer",
          )}
        >
          Agent thinking
        </span>
        <Icon
          name="expand_more"
          className={cn(
            "text-muted-foreground transition-transform duration-200",
            isExpanded ? "rotate-180" : "",
          )}
        />
      </button>
      <div
        className={cn(
          "transition-all duration-200 ease-in-out",
          isExpanded
            ? isPartStreaming
              ? "max-h-[400px] opacity-100"
              : "max-h-[200px] opacity-80"
            : "max-h-0 opacity-0 overflow-hidden",
        )}
      >
        <div
          className={cn(
            "border-l-2 pl-4 overflow-y-auto",
            isPartStreaming ? "max-h-[400px]" : "max-h-[200px]",
          )}
        >
          <div className={cn("text-muted-foreground markdown-sm pb-2")}>
            <MemoizedMarkdown
              key={index}
              id={`${messageId}-${index}-reasoning`}
              text={
                "details" in part &&
                Array.isArray(part.details) &&
                part.details[0] &&
                "text" in part.details[0]
                  ? (part.details[0] as { text: string }).text
                  : part.text
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
