import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useState } from "react";
import { MemoizedMarkdown } from "./chat-markdown.tsx";

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
  const [isHovered, setIsHovered] = useState(false);

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

  const showChevron = isHovered || isExpanded;
  const chevronIcon = isExpanded ? "expand_more" : "chevron_right";

  return (
    <div
      className="flex flex-col hover:bg-accent/25 rounded-2xl max-w-4xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 py-1 px-1.5 transition-colors cursor-pointer text-sm text-muted-foreground hover:text-foreground h-10"
      >
        {showChevron ? (
          <div className="w-5 flex items-center justify-center shrink-0">
            <Icon name={chevronIcon} size={16} />
          </div>
        ) : (
          <div className="w-5 flex items-center justify-center shrink-0">
            <Icon
              name="psychology"
              size={16}
              className={cn(
                "text-muted-foreground transition-opacity",
                isPartStreaming && "animate-pulse",
              )}
            />
          </div>
        )}
        <span
          className={cn(
            "text-sm font-medium text-muted-foreground",
            isPartStreaming && "text-shimmer",
          )}
        >
          Agent thinking
        </span>
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
        <div className="relative px-1.5 flex">
          <div className="w-5 flex items-center justify-center shrink-0">
            <div className="w-0.5 h-full bg-border" />
          </div>
          <div
            className={cn(
              "flex-1 pl-4 overflow-y-auto relative",
              isPartStreaming ? "max-h-[400px]" : "max-h-[200px]",
            )}
          >
            <div className={cn("text-muted-foreground markdown-sm pb-2")}>
              <MemoizedMarkdown
                key={index}
                messageId={`${messageId}-${index}-reasoning`}
                part={
                  "details" in part && Array.isArray(part.details)
                    ? part.details[0]
                    : { type: "text", text: part.text }
                }
              />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-background to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
