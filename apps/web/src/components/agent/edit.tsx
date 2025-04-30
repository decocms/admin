import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useSidebar } from "@deco/ui/components/sidebar.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { cn } from "@deco/ui/lib/utils.ts";
import { Suspense, useMemo } from "react";
import { useParams } from "react-router";
import { useAgentHasChanges } from "../../hooks/useAgentOverrides.ts";
import { ListActions } from "../actions/listActions.tsx";
import { useFocusChat } from "../agents/hooks.ts";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { DockedPageLayout } from "../pageLayout.tsx";
import AgentSettings from "../settings/agent.tsx";
import { AgentHeader } from "./DetailHeader.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";
import TestAgent from "./testAgent.tsx";

// Custom CSS to override shadow styles
const tabStyles = `
.custom-tabs [data-state] {
  box-shadow: none !important;
  outline: none !important;
}
.custom-tabs [role="tablist"] {
  box-shadow: none !important;
}
.custom-tabs [role="tab"]:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}
.tab-divider {
  position: absolute;
  top: 1%;
  bottom: 1%;
  width: 1px;
  background-color: #e2e8f0;
  left: 50%;
  transform: translateX(-50%);
}
`;

interface Props {
  agentId?: string;
  threadId?: string;
}

const MainHeader = () => <AgentHeader />;
const MainContent = () => <AgentSettings formId="agent-settings-form" />;

const MAIN = {
  header: MainHeader,
  main: MainContent,
};

const COMPONENTS = {
  testAgent: {
    title: "Test Agent",
    initialOpen: true,
    Component: TestAgent,
    hideDefaultHeader: true,
  },
  chatView: {
    Component: ThreadView,
    title: "Thread",
  },
  preview: {
    Component: AgentPreview,
    title: "Preview",
  },
  actions: {
    Component: ListActions,
    title: "Actions",
  },
};

function MobileChat() {
  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <ChatMessages />
      </div>
      <ChatInput />
    </>
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

  const threadId = useMemo(
    () => props.threadId || params.threadId || agentId,
    [props.threadId, params.threadId, agentId],
  );

  const isMobile = useIsMobile();
  const { toggleSidebar } = useSidebar();
  const { hasChanges, discardCurrentChanges } = useAgentHasChanges(agentId);
  const focusChat = useFocusChat();

  const chatKey = useMemo(() => `${agentId}-${threadId}`, [agentId, threadId]);

  return (
    <Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center">
          <Spinner />
        </div>
      }
      key={chatKey}
    >
      <ChatProvider
        agentId={agentId}
        threadId={threadId}
        uiOptions={{ showThreadTools: false }}
      >
        <div className="h-screen flex flex-col">
          <style>{tabStyles}</style>

          <div
            className={cn(
              "px-4 flex justify-between items-center border-b bg-slate-50 h-px overflow-hidden transition-all duration-300",
              isMobile && "h-auto py-2",
            )}
          >
            <div className="flex justify-between gap-2 w-full">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="mr-2 md:invisible"
              >
                <Icon name="menu" size={20} />
              </Button>
              <Button
                variant="outline"
                title="New Chat"
                className={cn(
                  (hasChanges || !isMobile) && "hidden",
                )}
                onClick={() =>
                  focusChat(agentId, crypto.randomUUID(), { history: false })}
              >
                <Icon name="chat_add_on" />
                New chat
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {isMobile
              ? (
                <Tabs
                  defaultValue="chat"
                  className="w-full h-full flex flex-col custom-tabs"
                >
                  <TabsList className="w-full border-b bg-slate-50 p-0 shadow-none h-12 border-none relative">
                    <TabsTrigger
                      value="chat"
                      className="flex-1 rounded-none py-2 px-0 data-[state=active]:bg-white focus:shadow-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 border-r-0"
                    >
                      Chat
                    </TabsTrigger>
                    <div className="tab-divider"></div>
                    <TabsTrigger
                      value="settings"
                      className="flex-1 rounded-none py-2 px-0 data-[state=active]:bg-white focus:shadow-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                    >
                      Edit Agent
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="chat"
                    className="flex-1 overflow-hidden flex flex-col m-0 p-0 border-0 shadow-none"
                  >
                    <MobileChat />
                  </TabsContent>
                  <TabsContent
                    value="settings"
                    className="flex-1 overflow-auto m-0 p-0 border-0 shadow-none px-4"
                  >
                    <AgentSettings formId="agent-settings-form" />
                  </TabsContent>
                </Tabs>
              )
              : (
                <DockedPageLayout
                  main={MAIN}
                  tabs={COMPONENTS}
                  key={agentId}
                />
              )}
          </div>
        </div>
      </ChatProvider>
    </Suspense>
  );
}

export default Agent;
