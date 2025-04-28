import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider, useChatContext } from "../chat/context.tsx";
import { DockedPageLayout } from "../pageLayout.tsx";
import AgentSettings from "../settings/agent.tsx";
import { AgentHeader } from "./DetailHeader.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useSidebar } from "@deco/ui/components/sidebar.tsx";
import { useIsMobile } from "../../../../../packages/ui/src/hooks/use-mobile.ts";
import { EmptyInputPrompt } from "../chat/EmptyInputPrompt.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useAgentHasChanges } from "../../hooks/useAgentOverrides.ts";

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
}

function ConditionalEmptyPrompt() {
  const { chat: { messages } } = useChatContext();
  return messages.length === 0 ? <EmptyInputPrompt /> : null;
}

const MainHeader = () => <AgentHeader />;
const MainContent = () => <ChatMessages />;
const MainFooter = () => (
  <>
    <ConditionalEmptyPrompt />
    <ChatInput />
  </>
);

const MAIN = {
  header: MainHeader,
  main: MainContent,
  footer: MainFooter,
};

const COMPONENTS = {
  chatView: {
    Component: ThreadView,
    title: "Thread",
  },
  settings: {
    Component: () => <AgentSettings formId="agent-settings-form" />,
    initialOpen: true,
    title: "Edit Agent",
  },
  preview: {
    Component: AgentPreview,
    title: "Preview",
  },
};

function MobileChat() {
  const { chat: { messages } } = useChatContext();
  const isEmpty = messages.length === 0;

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <ChatMessages />
      </div>
      <div className="p-2 border-t">
        {isEmpty && <EmptyInputPrompt />}
        <ChatInput />
      </div>
    </>
  );
}

let renderCount = 0;

function Agent(props: Props) {
  const params = useParams();
  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  if (!agentId) {
    return <div>Agent not found</div>;
  }

  const isMobile = useIsMobile();
  const { toggleSidebar } = useSidebar();
  const [isLoading, setIsLoading] = useState(false);
  const { hasChanges, discardCurrentChanges } = useAgentHasChanges(agentId);
  // const hasChanges = false;
  // const discardCurrentChanges = () => console.log("discardCurrentChanges");

  console.log("renderCount", renderCount++);

  const handleUpdate = () => {
    setIsLoading(true);
    try {
      const form = document.getElementById(
        "agent-settings-form",
      ) as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error updating agent:", error);
    }
  };

  return (
    <ChatProvider
      agentId={agentId}
      threadId={agentId}
      uiOptions={{ showThreadTools: false }}
    >
      <div className="h-screen flex flex-col">
        <style>{tabStyles}</style>

        <div className="px-4 py-2 flex justify-between items-center border-b bg-slate-50">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="mr-2 md:invisible"
          >
            <Icon name="menu" size={20} />
          </Button>
          <div className="flex gap-2">
            {hasChanges && (
              <Button
                variant="outline"
                className="text-slate-700"
                onClick={discardCurrentChanges}
              >
                Discard
              </Button>
            )}
            <Button
              className="bg-primary-light text-primary-dark hover:bg-primary-light/90 flex items-center justify-center w-[108px] gap-2"
              onClick={handleUpdate}
              disabled={!hasChanges}
            >
              {isLoading ? <Spinner size="xs" /> : <span>Save</span>}
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
  );
}

export default Agent;
