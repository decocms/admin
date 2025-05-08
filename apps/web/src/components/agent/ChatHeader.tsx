import { AgentNotFoundError, useAgent } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Suspense } from "react";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { useEditAgent, useFocusChat } from "../agents/hooks.ts";
import { useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import { HeaderSlot } from "../layout.tsx";

interface Props {
  agentId: string;
  mode?: "read-only";
}

export function ChatHeader({ mode }: { mode?: "read-only" }) {
  const { agentId } = useChatContext();

  return (
    <ErrorBoundary
      fallback={<ChatHeader.Fallback />}
      shouldCatch={(e) => e instanceof AgentNotFoundError}
    >
      <Suspense fallback={<ChatHeader.Skeleton />}>
        <ChatHeader.UI agentId={agentId} mode={mode} />
      </Suspense>
    </ErrorBoundary>
  );
}

ChatHeader.Fallback = () => {
  return (
    <Container>
      <Icon name="smart_toy" size={16} className="opacity-50" />
      <h1 className="text-sm font-medium tracking-tight opacity-50">
        This agent has been deleted
      </h1>
    </Container>
  );
};

ChatHeader.Skeleton = () => {
  return <div className="h-10 w-full" />;
};

ChatHeader.UI = ({ agentId, mode }: Props) => {
  const { chat } = useChatContext();
  const { data: agent } = useAgent(agentId);
  const focusChat = useFocusChat();
  const focusEditAgent = useEditAgent();

  return (
    <>
      <HeaderSlot position="start">
        <div className="flex items-center gap-3 h-10">
          <div className="w-6 h-6 rounded-xs overflow-hidden flex items-center justify-center">
            <AgentAvatar
              name={agent.name}
              avatar={agent.avatar}
              className="rounded-lg text-xs"
            />
          </div>
          <h1 className="text-sm font-medium tracking-tight">
            {agent.name}
          </h1>
        </div>
      </HeaderSlot>

      {mode !== "read-only" && (
        <HeaderSlot position="end">
          <div className="flex items-center">
            {chat.messages.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      focusChat(agentId, crypto.randomUUID(), {
                        history: false,
                      });
                    }}
                  >
                    <Icon name="edit_square" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  New chat
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    focusEditAgent(agentId, crypto.randomUUID(), {
                      history: false,
                    });
                  }}
                >
                  <Icon name="tune" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Edit Agent
              </TooltipContent>
            </Tooltip>
          </div>
        </HeaderSlot>
      )}
    </>
  );
};

const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="justify-self-start flex items-center gap-3 text-slate-700 py-1 w-full">
      {children}
    </div>
  );
};
