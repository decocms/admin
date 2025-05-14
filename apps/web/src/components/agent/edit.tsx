import { useAgent } from "@deco/sdk";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useMemo } from "react";
import { useParams } from "react-router";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider, useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import AgentSettings from "../settings/agent.tsx";
import { AgentTriggers } from "../triggers/agentTriggers.tsx";
import { AgentBreadcrumbSegment } from "./BreadcrumbSegment.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";

interface Props {
  agentId?: string;
  threadId?: string;
}

const Chat = () => {
  const { agentId, chat } = useChatContext();
  const { data: agent } = useAgent(agentId);

  return (
    <div className="flex flex-col h-full min-w-[320px]">
      <div className="flex-none p-4">
        <div className="justify-self-start flex items-center gap-3 text-slate-700 py-1">
          {chat.messages.length > 0 && (
            <>
              <div className="w-8 h-8 rounded-[10px] overflow-hidden flex items-center justify-center">
                <AgentAvatar
                  name={agent.name}
                  avatar={agent.avatar}
                  className="rounded-lg text-xs"
                />
              </div>
              <h1 className="text-sm font-medium tracking-tight">
                {agent.name}
              </h1>
            </>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <ChatMessages />
      </ScrollArea>
      <div className="flex-none pb-4 px-4">
        <ChatInput />
      </div>
    </div>
  );
};

const TABS = {
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
  triggers: {
    Component: AgentTriggers,
    title: "Agent Triggers",
    initialOpen: true,
  },

  chat: {
    Component: Chat,
    title: "Chat preview",
    initialOpen: true,
  },
  setup: {
    Component: AgentSettings,
    title: "Setup",
    initialOpen: true,
  },
};

export default function Page(props: Props) {
  const params = useParams();
  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  if (!agentId) {
    return <div>Agent not found</div>;
  }

  const threadId = useMemo(
    () => props.threadId || params.threadId || agentId,
    [props.threadId, params.threadId, agentId],
  );

  const chatKey = useMemo(
    () => `${agentId}-${threadId}`,
    [agentId, threadId],
  );

  return (
    <Suspense
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
        uiOptions={{
          showThreadTools: false,
        }}
      >
        <PageLayout
          tabs={TABS}
          key={agentId}
          breadcrumb={
            <DefaultBreadcrumb
              items={[
                { link: "/agents", label: "Agents" },
                {
                  label: (
                    <AgentBreadcrumbSegment
                      agentId={agentId}
                      variant="summary"
                    />
                  ),
                },
              ]}
            />
          }
        />
      </ChatProvider>
    </Suspense>
  );
}
