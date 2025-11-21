import {
  type AgentId,
  WELL_KNOWN_AGENT_IDS,
  WELL_KNOWN_DECOPILOT_AGENTS,
} from "@deco/sdk";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { useAgenticChat } from "../chat/provider.tsx";
import { useUser } from "../../hooks/use-user.ts";
import { useThreadOptional } from "../decopilot/thread-provider.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useAgentStore } from "../../stores/mode-store.ts";

// Extract short description from agent goals
const AGENT_DESCRIPTIONS: Record<AgentId, string> = {
  design: "Design documents for implementation planning",
  code: "Creates and modifies tools, workflows and views",
  explore: "Explore the system and it's capabilities",
  decopilot: "General purpose assistant for the platform",
};

export type WellKnownAgents =
  (typeof WELL_KNOWN_AGENT_IDS)[keyof typeof WELL_KNOWN_AGENT_IDS];

interface MainChatProps {
  showInput?: boolean;
  className?: string;
  contentClassName?: string;
  hasTabs?: boolean;
  isEmpty?: boolean;
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
}: MainChatProps = {}) => {
  // Use real-time chat messages to determine if empty, not the prop
  const { chat, forceBottomLayout } = useAgenticChat();
  const user = useUser();
  const threadContext = useThreadOptional();
  const { agentId: currentAgentId, setAgentId } = useAgentStore();
  const isEmpty = chat.messages.length === 0;
  const shouldCenterLayout = !forceBottomLayout && !hasTabs && isEmpty;
  const isCenteredLayout = !forceBottomLayout && !hasTabs;
  // Check if this is the first thread (no threads exist or only one thread)
  const threadCount = threadContext?.getAllThreads?.()?.length ?? 0;
  const isFirstThread = threadCount <= 1;

  // Get current agent from store for welcome message (updates immediately when changed)
  const currentAgent = useMemo(() => {
    return (
      WELL_KNOWN_DECOPILOT_AGENTS[currentAgentId] ||
      WELL_KNOWN_DECOPILOT_AGENTS.explore
    );
  }, [currentAgentId]);

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

  // isCentered should be true when in centered layout mode (no tabs, not forceBottomLayout)
  // This makes avatars appear on the side even when there are messages
  const isCentered = isCenteredLayout || isTransitioning;

  return (
    <div
      className={cn(
        "relative w-full flex flex-col h-full min-w-0",
        !isCentered && hasTabs && "transition-none transform-[translateZ(0)]",
        className,
      )}
    >
      {showCentered && isEmpty ? (
        /* Centered layout - welcome message and input grouped together */
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-12 transition-all duration-300 ease-(--ease-out-quint) animate-in fade-in slide-in-from-bottom-4">
          <div
            className={cn(
              "flex flex-col items-center gap-1 transition-opacity duration-300 ease-(--ease-out-quint)",
              isTransitioning && "opacity-0",
            )}
          >
            {currentAgent?.avatar && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    title="Switch agent"
                  >
                    <img
                      src={currentAgent.avatar}
                      alt={currentAgent.name}
                      className="size-[60px] rounded-[18px] border-[1.875px] border-border/10"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-72">
                  {(Object.keys(WELL_KNOWN_DECOPILOT_AGENTS) as AgentId[]).map(
                    (id) => {
                      const agentOption = WELL_KNOWN_DECOPILOT_AGENTS[id];
                      const isSelected = currentAgentId === id;
                      return (
                        <DropdownMenuItem
                          key={id}
                          onClick={() => setAgentId(id)}
                          className={cn(
                            "flex items-start gap-3 px-3 py-2.5 cursor-pointer",
                            isSelected && "bg-accent",
                          )}
                        >
                          <img
                            src={agentOption.avatar}
                            alt={agentOption.name}
                            className="size-6 rounded-[3.571px] object-cover flex-shrink-0 border border-border"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = "none";
                              const fallback =
                                target.nextElementSibling as HTMLElement;
                              if (fallback) {
                                fallback.style.display = "flex";
                              }
                            }}
                          />
                          <div
                            className="size-6 rounded-[3.571px] bg-muted border border-border items-center justify-center hidden flex-shrink-0"
                            style={{ display: "none" }}
                          >
                            <Icon
                              name="smart_toy"
                              size={14}
                              className="text-muted-foreground"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {agentOption.name}
                              </span>
                              {isSelected && (
                                <Icon
                                  name="check"
                                  size={14}
                                  className="text-foreground flex-shrink-0"
                                />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {AGENT_DESCRIPTIONS[id]}
                            </p>
                          </div>
                        </DropdownMenuItem>
                      );
                    },
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <h2 className="text-2xl font-medium text-foreground leading-8">
              {isFirstThread ? "Welcome" : "Hey"},{" "}
              {user?.metadata?.full_name || "there"} 👋
            </h2>
            <p className="text-muted-foreground text-center text-xl leading-7">
              What are we building today?
            </p>
          </div>
          {showInput && (
            <div className="w-full max-w-[900px] mt-16 transition-all duration-300 ease-(--ease-out-quint)">
              <ChatInput centered={true} />
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Welcome header - only shown in centered mode during transition */}
          {showCentered && !isEmpty && (
            <div
              className={cn(
                "flex flex-col items-center gap-1 transition-opacity duration-300 ease-(--ease-out-quint) mb-16",
                isTransitioning && "opacity-0",
              )}
            >
              {currentAgent?.avatar && (
                <img
                  src={currentAgent.avatar}
                  alt={currentAgent.name}
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

          {/* Messages */}
          <div
            className={cn(
              "flex-1 min-h-0 overflow-y-auto overflow-x-hidden",
              !hasTabs &&
                "animate-in fade-in slide-in-from-bottom-4 duration-300 ease-(--ease-out-quint)",
            )}
          >
            <ChatMessages
              className={contentClassName}
              centered={isCenteredLayout}
            />
          </div>

          {/* Input - always present, animates position */}
          {showInput && (
            <div
              className={cn(
                "min-w-0",
                isCenteredLayout &&
                  "w-full max-w-[900px] mx-auto transition-all duration-300 ease-(--ease-out-quint)",
                !isCenteredLayout && "flex-none p-2",
              )}
            >
              <ChatInput centered={isCenteredLayout} />
            </div>
          )}
        </>
      )}
    </div>
  );
};
