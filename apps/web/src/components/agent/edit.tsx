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
import { useAgent } from "../../../../../packages/sdk/src/index.ts";
import { ListActions } from "../actions/listActions.tsx";
import { useFocusChat } from "../agents/hooks.ts";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider, useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import { DockedPageLayout } from "../pageLayout.tsx";
import AgentSettings from "../settings/agent.tsx";
import { AgentHeader, Container } from "./DetailHeader.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";

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

`;

interface Props {
  agentId?: string;
  threadId?: string;
}

const Chat = () => {
  const { agentId, chat } = useChatContext();
  const { data: agent } = useAgent(agentId);

  return (
    <div className="grid grid-rows-[auto_1fr_auto] p-4 h-full">
      <Container>
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
      </Container>
      <ChatMessages />
      <ChatInput />
    </div>
  );
};

const MAIN = {
  header: AgentHeader,
  main: () => (
    <div className="h-full w-full max-w-[800px] mx-auto">
      <AgentSettings formId="agent-settings-form" />
    </div>
  ),
};

const TABS = {
  chatView: {
    Component: ThreadView,
    title: "Thread",
  },
  chat: {
    Component: Chat,
    initialOpen: true,
    title: "Test agent",
  },
  preview: {
    Component: AgentPreview,
    title: "Preview",
  },
  actions: {
    Component: ListActions,
    title: "Triggers",
  },
};

function MobileChat() {
  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <ChatMessages />
      </div>
      <div className="p-2 border-t">
        <ChatInput />
      </div>
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
        uiOptions={{
          showThreadTools: false,
          showEditAgent: false,
        }}
      >
        <div className="h-full flex flex-col">
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
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {isMobile
              ? (
                <Tabs
                  defaultValue="settings"
                  className="w-full h-full flex flex-col custom-tabs"
                >
                  <TabsList className="w-full border-b bg-slate-50 p-0 shadow-none h-12 border-none relative">
                    <TabsTrigger
                      value="settings"
                      className="flex-1 rounded-none py-2 px-0 data-[state=active]:bg-white focus:shadow-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                    >
                      Edit Agent
                    </TabsTrigger>
                    <div className="h-full w-[1px] bg-slate-200" />
                    <TabsTrigger
                      value="chat"
                      className="flex-1 rounded-none py-2 px-0 data-[state=active]:bg-white focus:shadow-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 border-r-0"
                    >
                      Test Agent
                    </TabsTrigger>
                    <div className="h-full w-[1px] bg-slate-200" />
                    <TabsTrigger
                      value="triggers"
                      className="flex-1 rounded-none py-2 px-0 data-[state=active]:bg-white focus:shadow-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 border-r-0"
                    >
                      Triggers
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
                  <TabsContent
                    value="triggers"
                    className="flex-1 overflow-auto m-0 p-0 border-0 shadow-none px-4"
                  >
                    <ListActions />
                  </TabsContent>
                </Tabs>
              )
              : (
                <DockedPageLayout
                  main={MAIN}
                  tabs={TABS}
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
