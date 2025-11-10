import { WELL_KNOWN_AGENT_IDS, type Agent } from "@deco/sdk";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useRef, useState } from "react";
import { useUser } from "../../hooks/use-user.ts";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { useAgenticChat } from "../chat/provider.tsx";
import { useThread } from "../decopilot/thread-provider.tsx";

export type WellKnownAgents =
  (typeof WELL_KNOWN_AGENT_IDS)[keyof typeof WELL_KNOWN_AGENT_IDS];

interface MainChatProps {
  showInput?: boolean;
  className?: string;
  contentClassName?: string;
  hasTabs?: boolean;
  isEmpty?: boolean;
  agent?: Agent;
}

export const MainChatSkeleton = ({
  showInput = true,
  className,
}: Pick<MainChatProps, "showInput" | "className"> = {}) => {
  return (
    <div className={`w-full flex flex-col h-full min-w-0 ${className ?? ""}`}>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="w-full min-w-0">
          {/* Empty state skeleton - centered */}
          <div className="h-full flex flex-col justify-between py-12">
            <div className="flex flex-col items-center justify-center max-w-2xl mx-auto p-4">
              <div className="flex flex-col items-center gap-4 mb-6">
                {/* Avatar skeleton */}
                <div className="w-12 h-12 flex items-center justify-center">
                  <Skeleton className="h-12 w-12 rounded-md" />
                </div>

                {/* Title and description skeletons */}
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-48" />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Skeleton className="h-5 w-96 max-w-[90vw]" />
                    <Skeleton className="h-5 w-72 max-w-[80vw]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showInput && (
        <div className="flex-none w-full mx-auto p-2">
          <div className="relative rounded-md w-full mx-auto">
            <div className="relative flex flex-col">
              {/* Rich text area skeleton */}
              <div className="overflow-y-auto relative">
                <Skeleton className="h-[88px] w-full rounded-t-2xl" />
              </div>

              {/* Input footer skeleton */}
              <div className="flex items-center justify-between h-12 border border-t-0 rounded-b-2xl px-2 bg-background">
                <div className="flex items-center gap-2" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-20 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const MainChat = ({
  showInput = true,
  className,
  contentClassName,
  hasTabs = true,
  agent,
}: MainChatProps = {}) => {
  // Use real-time chat messages to determine if empty, not the prop
  const { chat, forceBottomLayout } = useAgenticChat();
  const user = useUser();
  const { getAllThreads } = useThread();
  const isEmpty = chat.messages.length === 0;
  const shouldCenterLayout = !forceBottomLayout && !hasTabs && isEmpty;

  // Check if this is the first thread
  const allThreads = getAllThreads();
  const isFirstThread = allThreads.length <= 1;

  // Animation state: track when we're transitioning from centered to normal
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showCentered, setShowCentered] = useState(shouldCenterLayout);
  const prevHasTabs = useRef(hasTabs);

  useEffect(() => {
    if (shouldCenterLayout) {
      // Going to centered layout - show immediately
      setShowCentered(true);
      setIsTransitioning(false);
    } else if (showCentered && !shouldCenterLayout) {
      // Check if we're transitioning because tabs were opened
      const tabsJustOpened = hasTabs && !prevHasTabs.current;

      if (tabsJustOpened) {
        // Skip animation when tabs are opened - just switch immediately
        setShowCentered(false);
        setIsTransitioning(false);
      } else {
        // Leaving centered layout with animation (sending message)
        requestAnimationFrame(() => {
          setIsTransitioning(true);
        });
        const timer = setTimeout(() => {
          setShowCentered(false);
          setIsTransitioning(false);
        }, 300);
        return () => clearTimeout(timer);
      }
    }

    prevHasTabs.current = hasTabs;
  }, [shouldCenterLayout, showCentered, hasTabs]);

  const isCentered = showCentered || isTransitioning;

  return (
    <div
      className={cn(
        "relative w-full flex flex-col h-full min-w-0",
        isCentered &&
          "items-center justify-center px-10 py-12 transition-all duration-300 ease-(--ease-out-quint) animate-in fade-in slide-in-from-bottom-4",
        !isCentered && hasTabs && "transition-none transform-[translateZ(0)]",
        className,
      )}
    >
      {/* Welcome header - only shown in centered mode */}
      {showCentered && (
        <div
          className={cn(
            "flex flex-col items-center gap-1 transition-opacity duration-300 ease-(--ease-out-quint) mb-16",
            isTransitioning && "opacity-0",
          )}
        >
          {agent?.avatar && (
            <img
              src={agent.avatar}
              alt={agent.name}
              className="size-[60px] rounded-[18px] border-[1.875px] border-border/10"
            />
          )}
          <h2 className="text-2xl font-medium text-foreground leading-8">
            {isFirstThread ? "Welcome" : "Hey"},{" "}
            {user?.metadata?.full_name || "there"} 👋
          </h2>
          <p className="text-muted-foreground text-center text-xl leading-7">
            What are we building today?
          </p>
        </div>
      )}

      {/* Messages - only shown in normal mode */}
      {!showCentered && (
        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overflow-x-hidden",
            !hasTabs &&
              "animate-in fade-in slide-in-from-bottom-4 duration-300 ease-(--ease-out-quint)",
          )}
        >
          <ChatMessages className={contentClassName} />
        </div>
      )}

      {/* Input - always present, animates position */}
      {showInput && (
        <div
          className={cn(
            "min-w-0",
            isCentered &&
              "w-full max-w-[900px] transition-all duration-300 ease-(--ease-out-quint)",
            !isCentered && "flex-none p-2",
          )}
        >
          <ChatInput centered={isCentered} />
        </div>
      )}
    </div>
  );
};
