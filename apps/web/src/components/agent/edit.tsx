import {
  KEYS,
  NotFoundError,
  WELL_KNOWN_AGENTS,
  WELL_KNOWN_DECOPILOT_AGENTS,
  useAgentData,
  useAgentRoot,
  useFile,
  useSDK,
  useThreadMessages,
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
import { useQueryClient } from "@tanstack/react-query";
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useParams, useSearchParams } from "react-router";
import { useDocumentMetadata } from "../../hooks/use-document-metadata.ts";
import { useSaveAgent } from "../../hooks/use-save-agent.ts";
import { buildAgentUri, useThread } from "../decopilot/thread-provider.tsx";
import { isFilePath } from "../../utils/path.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import {
  AgenticChatProvider,
  createLegacyTransport,
  useAgenticChat,
} from "../chat/provider.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { useDecopilotThread } from "../decopilot/thread-context.tsx";
import AdvancedTab from "../settings/advanced.tsx";
import AgentProfileTab from "../settings/agent-profile.tsx";
import ToolsAndKnowledgeTab from "../settings/integrations.tsx";
import { AgentTriggers } from "../triggers/agent-triggers.tsx";
import Threads from "./threads.tsx";

interface Props {
  agentId?: string;
  threadId?: string;
  resourceUri?: string; // For well-known views: rsc://i:agent-management/agent/{agentId}
}

// Context for managing preview visibility on mobile and chat mode
interface PreviewContextValue {
  showPreview: boolean;
  togglePreview: () => void;
  isMobile: boolean;
  chatMode: "agent" | "decochat";
  setChatMode: (mode: "agent" | "decochat") => void;
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

// Unified chat interface that works for both agent and decopilot modes
function UnifiedChat() {
  const {
    metadata: { agentId },
    chat,
    agent,
    isDirty: hasChanges,
  } = useAgenticChat();
  const client = useQueryClient();
  const { locator } = useSDK();
  const { messages } = chat;
  const focusChat = useFocusChat();
  const { chatMode } = usePreviewContext();
  const isEmpty = messages.length === 0;
  // Decochat mode doesn't show threads or new thread buttons
  const isDecochatMode = chatMode === "decochat";
  const showNewThread = !isDecochatMode && !isEmpty && !hasChanges;
  const showThreadsButton = !isDecochatMode;

  return (
    <div className="flex flex-col h-full min-w-[320px] bg-sidebar relative">
      <div className="flex-none p-4 relative">
        <div className="justify-self-start flex items-center gap-3 text-muted-foreground w-full">
          <div
            className={cn(
              "flex items-center gap-2 w-full pr-24",
              isEmpty ? "hidden" : "",
            )}
          >
            <AgentAvatar url={agent.avatar} fallback={agent.name} size="sm" />
            <h1 className="text-sm font-medium tracking-tight">{agent.name}</h1>
          </div>
          {/* Use absolute positioning for buttons to prevent layout shift */}
          <div className="absolute right-4 top-4 flex items-center gap-2">
            {showNewThread && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  client.invalidateQueries({
                    queryKey: KEYS.THREADS(locator, { agentId }),
                  });
                  focusChat(agentId, crypto.randomUUID(), {
                    history: false,
                  });
                }}
              >
                New Thread
              </Button>
            )}
            {showThreadsButton && <ThreadsButton />}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ScrollArea>
          <ChatMessages />
        </ScrollArea>
      </div>
      <div className="flex-none pb-2 px-2">
        <ChatInput rightNode={<PreviewToggleButton />} />
      </div>
    </div>
  );
}

function ActionButtons() {
  const { isDirty: hasChanges, saveAgent, agent, form } = useAgenticChat();

  const handleSubmit = form.handleSubmit(async () => {
    await saveAgent();
  });

  const isWellKnownAgent = Boolean(
    WELL_KNOWN_AGENTS[agent.id as keyof typeof WELL_KNOWN_AGENTS],
  );

  if (!form) {
    return null;
  }

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;

  function discardChanges() {
    form?.reset();
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
        variant="default"
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

// Decochat-specific component that fetches its own data
function DecochatChat({
  effectiveDecochatThreadId,
  shouldUseInitialInput,
  threadState,
  clearThreadState,
}: {
  effectiveDecochatThreadId: string;
  shouldUseInitialInput: boolean;
  threadState: { initialMessage?: string | null; autoSend?: boolean | null };
  clearThreadState: () => void;
}) {
  const { locator } = useSDK();
  const exploreAgentId = WELL_KNOWN_DECOPILOT_AGENTS.explore.id;
  const { data: decopilotAgent } = useAgentData(exploreAgentId);
  const { data: { messages: decochatThreadMessages } = { messages: [] } } =
    useThreadMessages(effectiveDecochatThreadId, exploreAgentId, {
      shouldFetch: true,
    });

  const transport = useMemo(
    () =>
      createLegacyTransport(effectiveDecochatThreadId, exploreAgentId, locator),
    [effectiveDecochatThreadId, exploreAgentId, locator],
  );

  if (!decopilotAgent) return null;

  return (
    <AgenticChatProvider
      key={effectiveDecochatThreadId}
      agentId={exploreAgentId}
      threadId={effectiveDecochatThreadId}
      agent={decopilotAgent}
      transport={transport}
      initialMessages={decochatThreadMessages}
      initialInput={
        shouldUseInitialInput
          ? (threadState.initialMessage ?? undefined)
          : undefined
      }
      autoSend={shouldUseInitialInput ? (threadState.autoSend ?? false) : false}
      onAutoSendComplete={clearThreadState}
      uiOptions={{
        showEditAgent: false,
        showModelSelector: true,
        showThreadMessages: false,
        showAgentVisibility: false,
      }}
    >
      <UnifiedChat />
    </AgenticChatProvider>
  );
}

// Wrapper component that provides the right agent based on chat mode
function ChatWithProvider({ agentId }: { agentId: string; threadId: string }) {
  const { chatMode } = usePreviewContext();
  // Use the threadId prop directly for agent mode
  // Separate stable threadId for decochat mode using useState to maintain state when switching
  const [decochatThreadId] = useState(() => crypto.randomUUID());

  // Decopilot-specific hooks
  const { threadState, clearThreadState } = useDecopilotThread();

  // Use threadState.threadId when available for decochat mode
  const effectiveDecochatThreadId = threadState.threadId ?? decochatThreadId;

  // Only use initial input if there's an actual message and we're in decochat mode
  const shouldUseInitialInput = Boolean(
    chatMode === "decochat" &&
      threadState.initialMessage &&
      threadState.autoSend,
  );

  // Note: contextTools and contextRules are now managed via ThreadProvider
  // onToolCall is replaced by useToolCallListener hook

  // Determine which agent and threadId to use based on mode
  const chatAgentId =
    chatMode === "decochat" ? WELL_KNOWN_DECOPILOT_AGENTS.explore.id : agentId;

  if (!chatAgentId) return null;

  // For agent mode, use the outer provider context (no nested provider)
  // For decochat mode, create a separate provider
  return (
    <div className="h-full w-full">
      {/* Agent chat - uses outer provider context */}
      <div className={chatMode === "agent" ? "block h-full" : "hidden"}>
        <UnifiedChat />
      </div>

      {/* Decochat - has its own provider */}
      <div className={chatMode === "decochat" ? "block h-full" : "hidden"}>
        {chatMode === "decochat" && (
          <Suspense fallback={null}>
            <DecochatChat
              effectiveDecochatThreadId={effectiveDecochatThreadId}
              shouldUseInitialInput={shouldUseInitialInput}
              threadState={threadState}
              clearThreadState={clearThreadState}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function ResponsiveLayout({
  agentId,
  threadId,
}: {
  agentId: string;
  threadId: string;
}) {
  const { showPreview, isMobile } = usePreviewContext();

  if (isMobile) {
    // Mobile layout: stack or toggle between config and chat
    return (
      <div className="h-[calc(100vh-48px)] flex flex-col">
        {!showPreview ? (
          <AgentConfigs />
        ) : (
          <ChatWithProvider agentId={agentId} threadId={threadId} />
        )}
      </div>
    );
  }

  // Desktop layout: resizable panels
  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel className="h-[calc(100vh-88px)]" defaultSize={60}>
        <AgentConfigs />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel className="h-[calc(100vh-88px)]" defaultSize={40}>
        <ChatWithProvider agentId={agentId} threadId={threadId} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function FormProvider(props: Props & { agentId: string; threadId: string }) {
  const { agentId, threadId } = props;
  const { data: agent } = useAgentData(agentId);
  const agentRoot = useAgentRoot(agentId);
  const { data: { messages: threadMessages } = { messages: [] } } =
    useThreadMessages(threadId, { shouldFetch: true });
  const { data: resolvedAvatar } = useFile(
    agent?.avatar && isFilePath(agent.avatar) ? agent.avatar : "",
  );

  // Canvas tabs context for updating tab metadata
  const { tabs, activeTabId, addTab } = useThread();
  const [searchParams] = useSearchParams();
  const urlActiveTabId = searchParams.get("activeTab");
  const currentTabId = urlActiveTabId || activeTabId;

  // Mobile detection
  const isMobile = useIsMobile();
  const [showPreview, setShowPreview] = useState(false);

  const togglePreview = () => setShowPreview((prev) => !prev);

  // Chat mode state (agent chat vs decochat chat)
  const location = useLocation();
  const chatSearchParams = new URLSearchParams(location.search);
  const urlChatMode =
    (chatSearchParams.get("chat") as "agent" | "decochat") || "agent";

  const [chatMode, setChatMode] = useState<"agent" | "decochat">(urlChatMode);

  // Sync with URL changes
  useEffect(() => {
    setChatMode(urlChatMode);
  }, [urlChatMode]);

  // Update tab title when agent loads
  useEffect(() => {
    if (!agent || !currentTabId) return;

    const currentTab = tabs.find((t) => t.id === currentTabId);
    if (!currentTab) return;

    // Check if we need to update the tab
    const expectedUri = buildAgentUri(agentId, threadId);
    if (
      currentTab.resourceUri === expectedUri &&
      (currentTab.title === "Loading..." || currentTab.title !== agent.name)
    ) {
      addTab({
        type: "detail",
        resourceUri: expectedUri,
        title: agent.name,
        icon: "robot_2",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.name, agentId, threadId, currentTabId]);

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

  if (!agent) {
    return null;
  }

  const handleSaveAgent = useSaveAgent();

  const transport = useMemo(
    () => createLegacyTransport(threadId, agentId, agentRoot),
    [threadId, agentId, agentRoot],
  );

  // Check for stored initial message in sessionStorage
  const [initialInput, setInitialInput] = useState<string | undefined>(() => {
    const storedMessage = sessionStorage.getItem(
      `agent_initial_message_${agentId}_${threadId}`,
    );
    if (storedMessage) {
      // Clean up immediately
      sessionStorage.removeItem(`agent_initial_message_${agentId}_${threadId}`);
      return storedMessage;
    }
    return undefined;
  });

  const [autoSend, setAutoSend] = useState(!!initialInput);

  // Clear autoSend after sending
  const handleAutoSendComplete = useCallback(() => {
    setAutoSend(false);
    setInitialInput(undefined);
  }, []);

  return (
    <PreviewContext.Provider
      value={{ showPreview, togglePreview, isMobile, chatMode, setChatMode }}
    >
      <AgenticChatProvider
        agentId={agentId}
        threadId={threadId}
        agent={agent}
        transport={transport}
        initialMessages={threadMessages}
        initialInput={initialInput}
        autoSend={autoSend}
        onAutoSendComplete={handleAutoSendComplete}
        onSave={handleSaveAgent}
        uiOptions={{
          showEditAgent: false,
          showModelSelector: false,
          showThreadMessages: true,
          showAgentVisibility: false,
          showContextResources: true,
        }}
      >
        <ResponsiveLayout agentId={agentId} threadId={threadId} />
      </AgenticChatProvider>
    </PreviewContext.Provider>
  );
}

export default function Page(props: Props) {
  const params = useParams();

  // Extract agentId from resourceUri if provided
  const agentIdFromUri = useMemo(() => {
    if (props.resourceUri) {
      const parts = props.resourceUri.split("/");
      return parts[parts.length - 1];
    }
    return null;
  }, [props.resourceUri]);

  const agentId = useMemo(
    () => props.agentId || agentIdFromUri || params.id,
    [props.agentId, agentIdFromUri, params.id],
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
