import { WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";

export type WellKnownAgents =
  (typeof WELL_KNOWN_AGENT_IDS)[keyof typeof WELL_KNOWN_AGENT_IDS];

interface MainChatProps {
  showInput?: boolean;
  initialScrollBehavior?: "top" | "bottom";
  className?: string;
  contentClassName?: string;
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
  initialScrollBehavior = "bottom",
  className,
  contentClassName,
}: MainChatProps = {}) => {
  return (
    <div className={`w-full flex flex-col h-full min-w-0 ${className ?? ""}`}>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <ChatMessages
          initialScrollBehavior={initialScrollBehavior}
          className={contentClassName}
        />
      </div>
      {showInput && (
        <div className="flex-none p-2 min-w-0">
          <ChatInput />
        </div>
      )}
    </div>
  );
};
