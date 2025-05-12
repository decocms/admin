import { WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Suspense, useMemo } from "react";
import { useParams } from "react-router";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider, useChatContext } from "../chat/context.tsx";
import { PageLayout } from "../layout.tsx";
import ThreadSettingsTab from "../settings/chat.tsx";
import { AgentHeader } from "./DetailHeader.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";
import { useEditAgent, useFocusChat } from "../agents/hooks.ts";

interface Props {
  agentId?: string;
  threadId?: string;
  disableThreadMessages?: boolean;
  includeThreadTools?: boolean;
}

const MainChat = () => {
  return (
    <div className="h-full w-full flex flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <ChatMessages />
      </ScrollArea>
      <div className="pb-4">
        <ChatInput />
      </div>
    </div>
  );
};

const TABS = {
  chat: {
    Component: MainChat,
    title: "Chat",
    initialOpen: true,
  },
  chatView: {
    Component: ThreadView,
    title: "Thread",
    hideFromViews: true,
  },
  preview: {
    Component: AgentPreview,
    title: "Preview",
    hideFromViews: true,
  },
  tools: {
    Component: ThreadSettingsTab,
    title: "Chat settings",
    hideFromViews: true,
  },
};

function ActionsButtons() {
  const { agentId, chat } = useChatContext();
  const focusChat = useFocusChat();
  const focusAgent = useEditAgent();

  const displaySettings = agentId !== WELL_KNOWN_AGENT_IDS.teamAgent;
  const displayNewChat = displaySettings && chat.messages.length !== 0;

  if (!displayNewChat && !displaySettings) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {displayNewChat && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                focusChat(agentId, crypto.randomUUID(), {
                  history: false,
                })}
            >
              <Icon name="edit_square" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            New chat
          </TooltipContent>
        </Tooltip>
      )}

      {displaySettings && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                focusAgent(agentId, crypto.randomUUID(), {
                  history: false,
                })}
            >
              <Icon name="tune" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Agent Settings
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function Agent(props: Props) {
  const params = useParams();
  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  if (!agentId) {
    return <div>Agent not found</div>;
  }

  const propThreadId = props.threadId || params.threadId;
  const threadId = useMemo(
    () => propThreadId || agentId,
    [propThreadId, agentId],
  );

  const chatKey = useMemo(() => `${agentId}-${threadId}`, [agentId, threadId]);

  return (
    <Suspense
      // This make the react render fallback when changin agent+threadid, instead of hang the whole navigation while the subtree isn't changed
      key={chatKey}
      fallback={
        <div className="h-full w-full flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <ChatProvider
        agentId={agentId}
        threadId={threadId}
        uiOptions={{ showThreadTools: props.includeThreadTools || false }}
        disableThreadMessages={props.disableThreadMessages}
      >
        <PageLayout
          tabs={TABS}
          key={agentId}
          displayViewsTrigger={false}
          actionButtons={<ActionsButtons />}
          breadcrumb={agentId !== WELL_KNOWN_AGENT_IDS.teamAgent && (
            <AgentHeader agentId={agentId} />
          )}
        />
      </ChatProvider>
    </Suspense>
  );
}

export default Agent;
