import {
  type ProjectLocator,
  SDKProvider,
  UnauthorizedError,
  useAgentData,
  useAgentRoot,
  useThreadMessages,
} from "@deco/sdk";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import {
  SidebarInset,
  SidebarLayout,
  SidebarProvider,
} from "@deco/ui/components/sidebar.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "react-router";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { AgenticChatProvider } from "../chat/provider.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { ThreadContextProvider } from "../decopilot/thread-context-provider.tsx";
import { ChatHeader } from "./chat-header.tsx";

const MainChat = () => {
  return (
    <div className="h-full w-full flex flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <ChatMessages />
      </ScrollArea>
      <div className="flex-none p-2">
        <ChatInput />
      </div>
    </div>
  );
};

export const getPublicChatLink = (
  agentId: string,
  workspace: ProjectLocator,
) => {
  const url = new URL("/chats", globalThis.location.href);
  url.searchParams.set("agentId", agentId);
  url.searchParams.set("workspace", workspace);

  return url.href;
};

function Page() {
  const [params] = useSearchParams();

  const { agentId, workspace, threadId } = useMemo(() => {
    const workspace = params.get("workspace") as ProjectLocator | null;
    const agentId = params.get("agentId");
    const threadId = params.get("threadId") ?? crypto.randomUUID();
    if (!workspace || !agentId) {
      throw new Error("Missing required params: workspace, agentId");
    }

    return { workspace, agentId, threadId };
  }, [params]);

  const chatKey = useMemo(() => `${agentId}-${threadId}`, [agentId, threadId]);

  return (
    <ErrorBoundary
      shouldCatch={(e) => e instanceof UnauthorizedError}
      fallback={
        <EmptyState
          icon="robot_2"
          title="This agent is no longer available"
          description="The agent you're trying to access is no longer publicly available. Its visibility may have changed or it might have been removed."
          buttonProps={{
            variant: "outline",
            children: "Create your agent at deco CMS",
            onClick: () => {
              location.href = "https://admin.decocms.com";
            },
          }}
        />
      }
    >
      <Suspense
        // This make the react render fallback when changin agent+threadid, instead of hang the whole navigation while the subtree isn't changed
        key={chatKey}
        fallback={
          <div className="h-full w-full flex items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <SDKProvider locator={workspace}>
          <ThreadContextProvider>
            <ChatProviderWrapper agentId={agentId} threadId={threadId} />
          </ThreadContextProvider>
        </SDKProvider>
      </Suspense>
    </ErrorBoundary>
  );
}

function ChatProviderWrapper({
  agentId,
  threadId,
}: {
  agentId: string;
  threadId: string;
}) {
  const { data: agent } = useAgentData(agentId);
  const agentRoot = useAgentRoot(agentId);
  const { preferences } = useUserPreferences();
  const { data: { messages: threadMessages } = { messages: [] } } =
    useThreadMessages(threadId, { shouldFetch: false });

  if (!agent) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <AgenticChatProvider
      agentId={agentId}
      threadId={threadId}
      agent={agent}
      agentRoot={agentRoot}
      model={preferences.defaultModel}
      useOpenRouter={preferences.useOpenRouter}
      sendReasoning={preferences.sendReasoning}
      initialMessages={threadMessages}
      uiOptions={{
        showModelSelector: false,
        showThreadMessages: false,
        showAgentVisibility: false,
        showEditAgent: false,
        showContextResources: false,
        showAddIntegration: false,
      }}
    >
      <SidebarProvider>
        <SidebarLayout
          style={
            {
              "--sidebar-width": "13rem",
              "--sidebar-width-mobile": "11rem",
            } as Record<string, string>
          }
        >
          <SidebarInset>
            <div className="w-full h-12 border border-b px-8">
              <ChatHeader />
            </div>
            <MainChat />
          </SidebarInset>
        </SidebarLayout>
      </SidebarProvider>
    </AgenticChatProvider>
  );
}

export default Page;
