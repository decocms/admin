import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { DockedPageLayout } from "../pageLayout.tsx";
import AgentSettings from "../settings/agent.tsx";
import { AgentHeader } from "./DetailHeader.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";
import ThreadSettingsTab from "../settings/chat.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useSidebar } from "@deco/ui/components/sidebar.tsx";
import { useIsMobile } from "../../../../../packages/ui/src/hooks/use-mobile.ts";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useAgentHasChanges } from "../../hooks/useAgentOverrides.ts";
import { togglePanel, useDock } from "../dock/index.tsx";
import { useFocusChat } from "../agents/hooks.ts";

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
  disableThreadMessages?: boolean;
  includeThreadTools?: boolean;
}

const MainHeader = () => <AgentHeader />;
const MainContent = () => <ChatMessages />;
const MainFooter = () => <ChatInput />;

const MAIN = {
  header: MainHeader,
  main: MainContent,
  footer: MainFooter,
};

const SETTINGS_PANEL_ID = "settings";
const COMPONENTS = {
  chatView: {
    Component: ThreadView,
    title: "Thread",
  },
  [SETTINGS_PANEL_ID]: {
    Component: () => <AgentSettings formId="agent-settings-form" />,
    title: "Edit Agent",
  },
  preview: {
    Component: AgentPreview,
    title: "Preview",
  },
  tools: {
    Component: ThreadSettingsTab,
    title: "Thread Tools",
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

export function useOpenSettingsIfQueryParam() {
  const [searchParams] = useSearchParams();
  const { openPanels, availablePanels } = useDock();
  const openSettings = searchParams.get("openSettings") === "true";

  useEffect(() => {
    if (
      openSettings && availablePanels.has(SETTINGS_PANEL_ID) &&
      !openPanels.has(SETTINGS_PANEL_ID)
    ) {
      togglePanel({
        id: SETTINGS_PANEL_ID,
        component: SETTINGS_PANEL_ID,
        title: "Edit Agent",
      });

      const url = new URL(globalThis.location.href);
      url.searchParams.delete("openSettings");
      globalThis.history.replaceState({}, "", url.toString());
    }
  }, [openSettings, availablePanels, openPanels]);

  return openSettings;
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
  const [isLoading, setIsLoading] = useState(false);
  const { hasChanges, discardCurrentChanges } = useAgentHasChanges(agentId);
  const focusChat = useFocusChat();

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
      threadId={threadId}
      uiOptions={{ showThreadTools: props.includeThreadTools || false }}
      disableThreadMessages={props.disableThreadMessages}
    >
      <div className="h-screen flex flex-col">
        <style>{tabStyles}</style>

        <div
          className={cn(
            "px-4 flex justify-between items-center border-b bg-slate-50 h-px overflow-hidden transition-all duration-300",
            (isMobile || hasChanges) && "h-auto py-2",
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
              onClick={() => focusChat(agentId, crypto.randomUUID())}
            >
              <Icon name="chat_add_on" />
              New chat
            </Button>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <>
                <Button
                  variant="outline"
                  className="text-slate-700"
                  onClick={discardCurrentChanges}
                >
                  Discard
                </Button>
                <Button
                  className="bg-primary-light text-primary-dark hover:bg-primary-light/90 flex items-center justify-center w-[108px] gap-2"
                  onClick={handleUpdate}
                  disabled={!hasChanges}
                >
                  {isLoading ? <Spinner size="xs" /> : <span>Save</span>}
                </Button>
              </>
            )}
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
