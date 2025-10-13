import {
  NotFoundError,
  useAgentData,
  useFile,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@deco/ui/components/resizable.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { cn } from "@deco/ui/lib/utils.ts";
import { createContext, Suspense, useContext, useMemo, useState } from "react";
import { useParams } from "react-router";
import { useDocumentMetadata } from "../../hooks/use-document-metadata.ts";
import { isFilePath } from "../../utils/path.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { DecopilotLayout } from "../layout/decopilot-layout.tsx";
import AdvancedTab from "../settings/advanced.tsx";
import AgentProfileTab from "../settings/agent-profile.tsx";
import ToolsAndKnowledgeTab from "../settings/integrations.tsx";
import { AgentTriggers } from "../triggers/agent-triggers.tsx";
import { AgentProvider, useAgent } from "./provider.tsx";
import Threads from "./threads.tsx";

interface Props {
  agentId?: string;
  threadId?: string;
}

// Context for managing preview visibility on mobile
interface PreviewContextValue {
  showPreview: boolean;
  togglePreview: () => void;
  isMobile: boolean;
}

const PreviewContext = createContext<PreviewContextValue | undefined>(
  undefined,
);

function usePreviewContext() {
  const context = useContext(PreviewContext);
  if (!context) {
    throw new Error("usePreviewContext must be used within PreviewProvider");
  }
  return context;
}

function ThreadsButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="size-8">
          <Icon name="history" size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <Suspense
          fallback={
            <div className="px-12 py-20 grid place-items-center">
              <Spinner size="sm" />
            </div>
          }
        >
          <Threads />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}

function Chat() {
  const { agentId, chat, agent, hasUnsavedChanges: hasChanges } = useAgent();
  const { messages } = chat;
  const focusChat = useFocusChat();

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full min-w-[320px] bg-muted/50 relative">
      <div className="flex-none p-4">
        <div className="justify-self-start flex items-center gap-3 text-muted-foreground w-full">
          <div
            className={cn(
              "flex justify-between items-center gap-2 w-full",
              isEmpty ? "justify-end" : "",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2 w-full",
                isEmpty ? "hidden" : "",
              )}
            >
              <AgentAvatar url={agent.avatar} fallback={agent.name} size="sm" />
              <h1 className="text-sm font-medium tracking-tight">
                {agent.name}
              </h1>
            </div>
            <Button
              className={
                !isEmpty && !hasChanges ? "inline-flex text-xs" : "hidden"
              }
              variant="outline"
              size="sm"
              onClick={() =>
                focusChat(agentId, crypto.randomUUID(), {
                  history: false,
                })
              }
            >
              New Thread
            </Button>
            <ThreadsButton />
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <ChatMessages />
      </ScrollArea>
      <div className="flex-none pb-4 px-4">
        <ChatInput rightNode={<PreviewToggleButton />} />
      </div>
    </div>
  );
}

function ActionButtons() {
  const {
    form,
    hasUnsavedChanges: hasChanges,
    handleSubmit,
    agent,
  } = useAgent();

  const isWellKnownAgent = Boolean(
    WELL_KNOWN_AGENTS[agent.id as keyof typeof WELL_KNOWN_AGENTS],
  );

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;

  function discardChanges() {
    form.reset();
  }

  return (
    <div className="flex items-center gap-2 bg-sidebar transition-opacity">
      {!isWellKnownAgent && (
        <Button
          type="button"
          variant="outline"
          disabled={form.formState.isSubmitting}
          onClick={discardChanges}
          className={hasChanges ? "inline-flex" : "hidden"}
        >
          Discard
        </Button>
      )}

      <Button
        className={hasChanges ? "inline-flex" : "hidden"}
        variant="special"
        onClick={handleSubmit}
        disabled={!numberOfChanges || form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <>
            <Spinner size="xs" />
            <span>Saving...</span>
          </>
        ) : (
          <span>
            {isWellKnownAgent
              ? "Save Agent"
              : `Save ${numberOfChanges} change${
                  numberOfChanges > 1 ? "s" : ""
                }`}
          </span>
        )}
      </Button>
    </div>
  );
}

// Unified preview toggle button for mobile
function PreviewToggleButton() {
  const { showPreview, togglePreview, isMobile } = usePreviewContext();

  if (!isMobile) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={togglePreview}
      title={showPreview ? "Back to settings" : "Show preview"}
      className="h-10 w-10"
    >
      <Icon name={showPreview ? "settings" : "visibility"} size={16} />
    </Button>
  );
}

function AgentConfigs() {
  const { isMobile } = usePreviewContext();

  return (
    <div className="h-full flex flex-col gap-2 py-2 relative">
      <Tabs defaultValue="profile">
        <div className="flex items-center justify-between px-4">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="triggers">Triggers</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          <ActionButtons />
        </div>
        <ScrollArea className="h-[calc(100vh-100px)] overflow-y-scroll">
          <TabsContent value="profile">
            <AgentProfileTab />
          </TabsContent>
          <TabsContent value="tools">
            <ToolsAndKnowledgeTab />
          </TabsContent>
          <TabsContent value="triggers">
            <AgentTriggers />
          </TabsContent>
          <TabsContent value="advanced">
            <Suspense fallback={<AdvancedTab.Skeleton />}>
              <AdvancedTab />
            </Suspense>
          </TabsContent>
        </ScrollArea>
      </Tabs>
      {/* Floating preview toggle button for mobile - bottom right corner */}
      {isMobile && (
        <div className="fixed bottom-6 right-6 z-50">
          <PreviewToggleButton />
        </div>
      )}
    </div>
  );
}

function ResponsiveLayout() {
  const { showPreview, isMobile } = usePreviewContext();

  if (isMobile) {
    // Mobile layout: stack or toggle between config and preview
    return (
      <div className="h-[calc(100vh-48px)] flex flex-col">
        {!showPreview ? <AgentConfigs /> : <Chat />}
      </div>
    );
  }

  // Desktop layout: resizable panels
  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel className="h-[calc(100vh-48px)]" defaultSize={60}>
        <AgentConfigs />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel className="h-[calc(100vh-48px)]" defaultSize={40}>
        <Chat />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function FormProvider(props: Props & { agentId: string; threadId: string }) {
  const { agentId, threadId } = props;
  const { data: agent } = useAgentData(agentId);
  const { data: resolvedAvatar } = useFile(
    agent?.avatar && isFilePath(agent.avatar) ? agent.avatar : "",
  );

  // Mobile detection
  const isMobile = useIsMobile();
  const [showPreview, setShowPreview] = useState(false);

  const togglePreview = () => setShowPreview((prev) => !prev);

  // Prepare decopilot context value for agent edit
  const decopilotContextValue = useMemo(() => {
    if (!agent) return {};

    const rules: string[] = [
      `You are helping with agent editing and configuration. The current agent is "${agent.name}". Focus on operations related to agent configuration, tool management, knowledge base integration, and agent optimization.`,
      `When working with this agent (${agent.name}), prioritize operations that help users configure the agent's behavior, manage its tools and integrations, optimize its performance, and understand its capabilities. Consider the agent's current configuration and settings when providing assistance.`,
    ];

    return {
      rules,
    };
  }, [agent]);

  useDocumentMetadata({
    title: agent ? `${agent.name} | deco CMS` : undefined,
    description: agent
      ? (agent.description ?? agent.instructions ?? "")
      : undefined,
    favicon: isFilePath(agent?.avatar)
      ? typeof resolvedAvatar === "string"
        ? resolvedAvatar
        : undefined
      : agent?.avatar,
    socialImage: agent?.avatar,
  });

  return (
    <DecopilotLayout value={decopilotContextValue}>
      <PreviewContext.Provider value={{ showPreview, togglePreview, isMobile }}>
        <AgentProvider
          agentId={agentId}
          threadId={threadId}
          uiOptions={{
            showThreadTools: false,
            showEditAgent: false,
            showModelSelector: false,
          }}
        >
          <ResponsiveLayout />
        </AgentProvider>
      </PreviewContext.Provider>
    </DecopilotLayout>
  );
}

export default function Page(props: Props) {
  const params = useParams();
  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  const threadId = useMemo(
    () => props.threadId || params.threadId || agentId,
    [props.threadId, params.threadId, agentId],
  );

  const chatKey = useMemo(() => `${agentId}-${threadId}`, [agentId, threadId]);

  if (!agentId) {
    throw new NotFoundError("Agent not found");
  }

  return (
    <Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <FormProvider
        {...props}
        agentId={agentId}
        threadId={threadId!}
        key={chatKey}
      />
    </Suspense>
  );
}
