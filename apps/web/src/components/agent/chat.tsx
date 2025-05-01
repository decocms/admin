import { WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useSidebar } from "@deco/ui/components/sidebar.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { cn } from "@deco/ui/lib/utils.ts";
import { ComponentType, Suspense, useMemo } from "react";
import { useParams } from "react-router";
import { useFocusChat } from "../agents/hooks.ts";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { DockedPageLayout } from "../pageLayout.tsx";
import ThreadSettingsTab from "../settings/chat.tsx";
import { ChatHeader } from "./ChatHeader.tsx";
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
  disableThreadMessages?: boolean;
  includeThreadTools?: boolean;
}

const MainHeader = () => <ChatHeader />;
const MainContent = () => <ChatMessages />;
const MainFooter = () => (
  <div className="h-full w-full pb-4">
    <ChatInput />
  </div>
);

const COMPONENTS = {
  chatView: {
    Component: ThreadView,
    title: "Thread",
  },
  preview: {
    Component: AgentPreview as ComponentType,
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
      <div className="pb-4 p-2">
        <ChatInput withoutTools />
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

  const propThreadId = props.threadId || params.threadId;
  const threadId = useMemo(
    () => propThreadId || agentId,
    [propThreadId, agentId],
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
      // This make the react render fallback when changin agent+threadid, instead of hang the whole navigation while the subtree isn't changed
      key={chatKey}
    >
      <ChatProvider
        agentId={agentId}
        threadId={threadId}
        uiOptions={{ showThreadTools: props.includeThreadTools || false }}
        disableThreadMessages={props.disableThreadMessages}
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
              <Button
                variant="outline"
                title="New Chat"
                className={cn(
                  !isMobile && "hidden",
                )}
                onClick={() =>
                  focusChat(agentId, crypto.randomUUID(), { history: false })}
              >
                New chat
              </Button>
            </div>
            <div className="flex gap-2">
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {isMobile
              ? (
                <div className="flex-1 overflow-hidden flex h-full justify-center flex-col m-0 p-0 border-0 shadow-none">
                  <MobileChat />
                </div>
              )
              : (
                <DockedPageLayout
                  main={{
                    header: agentId === WELL_KNOWN_AGENT_IDS.teamAgent
                      ? undefined
                      : MainHeader,
                    main: MainContent,
                    footer: MainFooter,
                  }}
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
