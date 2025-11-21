import type { LanguageModelV2FinishReason } from "@ai-sdk/provider";
import type { UIMessage } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import {
  AgentSchema,
  DECO_CMS_API_URL,
  dispatchMessages,
  getTraceDebugId,
  KEYS,
  Locator,
  useAppendThreadMessage,
  useIntegrations,
  useSDK,
  WELL_KNOWN_AGENTS,
  type Agent,
  type MessageMetadata,
} from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
  type RefObject,
} from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useBlocker, useLocation } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { trackEvent } from "../../hooks/analytics.ts";
import { useTriggerToolCallListeners } from "../../hooks/use-tool-call-listener.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { useUser } from "../../hooks/use-user.ts";
import { notifyResourceUpdate } from "../../lib/broadcast-channels.ts";
import { useAgentStore } from "../../stores/mode-store.ts";
import { useChatStore } from "../../stores/chat-store.ts";
import { useAddVersion } from "../../stores/resource-version-history/index.ts";
import { createResourceVersionHistoryStore } from "../../stores/resource-version-history/store.ts";
import type { VersionHistoryActions } from "../../stores/resource-version-history/types.ts";
import {
  deriveReadToolFromUpdate,
  extractResourceUriFromInput,
  extractUpdateDataFromInput,
  isResourceReadTool,
  isResourceUpdateOrCreateTool,
  isResourceUpdateTool,
} from "../../stores/resource-version-history/utils.ts";
import {
  extractResourceUri,
  openResourceTab,
} from "../../utils/resource-tabs.ts";
import { IMAGE_REGEXP, openPreviewPanel } from "../chat/utils/preview.ts";
import { useThread } from "../decopilot/thread-provider.tsx";

// Preload notification audio at module level for instant playback
const notificationAudio = (() => {
  if (typeof window === "undefined") return null;
  const audio = new Audio("/notification.mp3");
  audio.preload = "auto";
  // Preload the audio immediately
  audio.load();
  return audio;
})();

/**
 * Helper function to create a user text message
 */
export function asUserMessage(text: string): UIMessage {
  return {
    role: "user",
    id: crypto.randomUUID(),
    parts: [{ type: "text", text }],
  };
}

interface UiOptions {
  showModelSelector: boolean;
  showThreadMessages: boolean;
  showAgentVisibility: boolean;
  showEditAgent: boolean;
  showContextResources: boolean;
  showAddIntegration: boolean;
  readOnly: boolean;
}

export interface RuntimeError {
  message: string;
  displayMessage?: string;
  errorCount?: number;
  context?: Record<string, unknown>;
}

export interface RuntimeErrorEntry {
  message: string;
  name: string;
  stack?: string;
  timestamp: string;
  type?: string;
  // Resource context
  resourceUri?: string;
  resourceName?: string;
  // Error source location (for view errors)
  source?: string;
  line?: number;
  column?: number;
  // Additional context
  target?: string;
  reason?: unknown;
}

export interface AgenticChatProviderProps {
  // Agent config
  agentId: string;
  threadId: string;
  agent: Agent; // Required agent data
  transport: DefaultChatTransport<UIMessage>; // Transport for chat communication
  onSave?: (agent: Agent) => Promise<void>;

  // Chat options
  initialMessages?: UIMessage[];
  initialInput?: string;
  autoSend?: boolean;
  onAutoSendComplete?: () => void;

  // UI options
  uiOptions?: Partial<UiOptions>;

  // Layout options
  forceBottomLayout?: boolean; // When true, always show input at bottom (never center)

  children: React.ReactNode;
}

export interface AgenticChatContextValue {
  agent: z.infer<typeof AgentSchema>;
  isDirty: boolean;
  updateAgent: (updates: Partial<Agent>) => void;
  saveAgent: () => Promise<void>;
  resetAgent: () => void;

  // Form state (for settings components)
  form: UseFormReturn<Agent>;

  // Chat state
  chat: ReturnType<typeof useChat>;
  finishReason: LanguageModelV2FinishReason | null;
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;

  // Chat methods
  sendMessage: (message?: UIMessage) => Promise<void>;
  retry: (context?: string[]) => Promise<void>;

  // Runtime error state
  runtimeError: RuntimeError | null;
  runtimeErrorEntries: RuntimeErrorEntry[];
  showError: (error: RuntimeError) => void;
  appendError: (
    error: Error | unknown | RuntimeErrorEntry,
    resourceUri?: string,
    resourceName?: string,
  ) => void;
  clearError: () => void;

  // UI options
  uiOptions: UiOptions;

  // Layout options
  forceBottomLayout: boolean;

  // Metadata
  metadata: {
    agentId: string;
    threadId: string;
  };

  // Refs
  correlationIdRef: RefObject<string | null>;
}

// Normalized view of a tool output part
interface NormalizedToolPart {
  isTool: boolean;
  typeStr?: string;
  state?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  output?: { uri?: string; data?: unknown };
  toolCallId?: string;
}

interface HandleToolDeps {
  readCheckpointRef: RefObject<Map<string, string>>;
  addVersion: VersionHistoryActions["addVersion"];
  threadId: string;
}

function normalizeToolPart(part: unknown): NormalizedToolPart {
  const typeStr = (part as { type?: string })?.type;
  if (!(typeof typeStr === "string" && typeStr.startsWith("tool-"))) {
    return { isTool: false };
  }

  const state = (part as { state?: string })?.state;
  const inputObj = (part as { input?: unknown })?.input as
    | Record<string, unknown>
    | undefined;
  const toolCallId = (part as { toolCallId?: string })?.toolCallId;
  const output = (part as { output?: unknown })?.output as
    | { uri?: string; data?: unknown }
    | undefined;

  const isCallTool = typeStr === "tool-CALL_TOOL";
  let toolName: string | undefined;
  let args: Record<string, unknown> | undefined;

  if (isCallTool) {
    const params = inputObj?.params as Record<string, unknown> | undefined;
    const name = params?.name as string | undefined;
    const integrationId = (inputObj?.id as string | undefined) ?? undefined;
    toolName = integrationId && name ? `${integrationId}__${name}` : name;
    args =
      (params?.arguments as Record<string, unknown> | undefined) ?? undefined;
  } else {
    const afterPrefix = typeStr.slice("tool-".length);
    toolName = afterPrefix || undefined;
    args = inputObj;
  }

  return { isTool: true, typeStr, state, toolName, args, output, toolCallId };
}

function handleReadCheckpointFromPart(
  info: NormalizedToolPart,
  deps: HandleToolDeps,
): void {
  if (!isResourceReadTool(info.toolName)) return;

  const uri = info.args ? extractResourceUriFromInput(info.args) : null;
  const structuredContent = (
    info.output as
      | { structuredContent?: { uri?: string; data?: unknown } }
      | undefined
  )?.structuredContent;
  const readData = structuredContent?.data ?? info.output?.data;
  const fallbackUri = structuredContent?.uri ?? info.output?.uri;
  const finalUri = uri ?? fallbackUri ?? null;

  if (!finalUri || readData === undefined) return;

  try {
    const serialized = JSON.stringify(readData);
    deps.readCheckpointRef.current?.set(finalUri, serialized);

    const existing =
      createResourceVersionHistoryStore.getState().history[finalUri];
    if (!existing || existing.length === 0) {
      void deps.addVersion(
        finalUri,
        serialized,
        {
          toolCallId: info.toolCallId,
          toolName: info.toolName ?? undefined,
          input: { uri: finalUri, data: readData },
        },
        deps.threadId,
      );
    }
  } catch (e) {
    console.warn("Failed to serialize READ data for checkpoint", e);
  }
}

function handleUpdateOrCreateFromPart(
  info: NormalizedToolPart,
  deps: HandleToolDeps,
): void {
  if (!isResourceUpdateOrCreateTool(info.toolName)) return;
  if (!info.args || typeof info.args !== "object") return;

  const uri = extractResourceUriFromInput(info.args);
  if (!uri) return;

  try {
    if (isResourceUpdateTool(info.toolName)) {
      const checkpoint = deps.readCheckpointRef.current?.get(uri);

      if (checkpoint) {
        // Always save the checkpoint as a pre-update version (even if versions exist)
        // This ensures we capture the "before" state for every update
        const readToolName = deriveReadToolFromUpdate(info.toolName);

        void deps.addVersion(
          uri,
          checkpoint,
          {
            toolCallId: info.toolCallId,
            toolName: readToolName ?? undefined,
            input: {
              ...info.args,
              uri,
              // oxlint-disable-next-line no-restricted-syntax
              data: JSON.parse(checkpoint),
            },
          },
          deps.threadId,
        );

        deps.readCheckpointRef.current?.delete(uri);
      }

      const updateData = extractUpdateDataFromInput(info.args);
      const serialized = safeStringify(updateData);

      if (serialized) {
        void deps.addVersion(
          uri,
          serialized,
          {
            toolCallId: info.toolCallId,
            toolName: info.toolName ?? undefined,
            input: info.args,
          },
          deps.threadId,
        );
      }
    }
  } catch (e) {
    console.warn("Version history tracking failed", e);
  }

  notifyResourceUpdate(uri);
}

const DEFAULT_UI_OPTIONS: UiOptions = {
  showModelSelector: true,
  showThreadMessages: true,
  showAgentVisibility: true,
  showEditAgent: true,
  showContextResources: true,
  showAddIntegration: true,
  readOnly: false,
};

// Unified chat state
interface ChatState {
  finishReason: LanguageModelV2FinishReason | null;
  isLoading: boolean;
  input: string;
  runtimeError: RuntimeError | null;
  runtimeErrorEntries: RuntimeErrorEntry[];
}

type ChatStateAction =
  | {
      type: "SET_FINISH_REASON";
      finishReason: LanguageModelV2FinishReason | null;
    }
  | { type: "SET_IS_LOADING"; isLoading: boolean }
  | { type: "SET_INPUT"; input: string }
  | { type: "SET_RUNTIME_ERROR"; runtimeError: RuntimeError | null }
  | { type: "APPEND_RUNTIME_ERROR"; error: RuntimeErrorEntry }
  | { type: "CLEAR_RUNTIME_ERRORS" };

function chatStateReducer(
  state: ChatState,
  action: ChatStateAction,
): ChatState {
  switch (action.type) {
    case "SET_FINISH_REASON":
      return { ...state, finishReason: action.finishReason };
    case "SET_IS_LOADING":
      return { ...state, isLoading: action.isLoading };
    case "SET_INPUT":
      return { ...state, input: action.input };
    case "SET_RUNTIME_ERROR":
      return { ...state, runtimeError: action.runtimeError };
    case "APPEND_RUNTIME_ERROR":
      return {
        ...state,
        runtimeErrorEntries: [...state.runtimeErrorEntries, action.error],
      };
    case "CLEAR_RUNTIME_ERRORS":
      return { ...state, runtimeErrorEntries: [], runtimeError: null };
    default:
      return state;
  }
}

export const AgenticChatContext = createContext<AgenticChatContextValue | null>(
  null,
);

// Standalone dispatcher functions removed - use the useAgenticChat hook instead

// Transport factory functions
export function createDecopilotTransport(
  threadId: string,
  agentId: string,
  locator: string,
): DefaultChatTransport<UIMessage> {
  return new DefaultChatTransport({
    api: new URL(`${locator}/agents/decopilot/stream`, DECO_CMS_API_URL).href,
    credentials: "include",
    prepareSendMessagesRequest: ({
      messages,
      requestMetadata,
    }: {
      messages: UIMessage[];
      requestMetadata?: unknown;
    }) => {
      // oxlint-disable-next-line no-explicit-any
      const metadata = requestMetadata as any;
      const modelId = metadata?.model;
      const useOpenRouterValue = metadata?.bypassOpenRouter === false;

      return {
        body: {
          messages,
          model: modelId
            ? {
                id: modelId,
                useOpenRouter: useOpenRouterValue,
              }
            : undefined,
          temperature: metadata?.temperature,
          maxOutputTokens: metadata?.maxTokens,
          maxStepCount: metadata?.maxSteps,
          maxWindowSize: metadata?.lastMessages,
          system: metadata?.instructions,
          context: metadata?.context,
          tools: metadata?.tools,
          threadId: threadId ?? agentId,
          agentId: metadata?.agentId,
        },
      };
    },
  });
}

export function createLegacyTransport(
  threadId: string,
  agentId: string,
  agentRoot: string,
): DefaultChatTransport<UIMessage> {
  return new DefaultChatTransport({
    api: new URL("/actors/AIAgent/invoke/stream", DECO_CMS_API_URL).href,
    credentials: "include",
    headers: {
      "x-deno-isolate-instance-id": agentRoot,
      "x-trace-debug-id": getTraceDebugId(),
    },
    prepareSendMessagesRequest: ({
      messages,
      requestMetadata,
    }: {
      messages: UIMessage[];
      requestMetadata?: unknown;
    }) => ({
      body: {
        metadata: { threadId: threadId ?? agentId },
        args: [messages.slice(-1), requestMetadata],
      },
    }),
  });
}

export function AgenticChatProvider({
  agentId,
  threadId,
  agent: initialAgent,
  transport,
  onSave,
  initialMessages,
  initialInput,
  autoSend,
  onAutoSendComplete,
  uiOptions,
  forceBottomLayout = false,
  children,
}: PropsWithChildren<AgenticChatProviderProps>) {
  const { pathname } = useLocation();
  const {
    contextItems: threadContextItems,
    tabs,
    addTab,
    setActiveTab,
  } = useThread();
  const { data: integrations = [] } = useIntegrations();
  const triggerToolCallListeners = useTriggerToolCallListeners();
  const queryClient = useQueryClient();
  const { locator } = useSDK();
  const { preferences } = useUserPreferences();
  const user = useUser();

  // Reactive mutation for appending messages
  const appendMessagesMutation = useAppendThreadMessage();

  const [state, dispatch] = useReducer(chatStateReducer, {
    finishReason: null,
    isLoading: false,
    input: initialInput || "",
    runtimeError: null,
    runtimeErrorEntries: [],
  });

  const { finishReason, isLoading, input, runtimeErrorEntries } = state;

  const setIsLoading = useCallback(
    (value: boolean) => {
      dispatch({ type: "SET_IS_LOADING", isLoading: value });
    },
    [threadId, agentId],
  );

  const setFinishReason = useCallback(
    (value: LanguageModelV2FinishReason | null) => {
      dispatch({ type: "SET_FINISH_REASON", finishReason: value });
    },
    [],
  );

  const setInput = useCallback((value: string) => {
    dispatch({ type: "SET_INPUT", input: value });
  }, []);

  const showError = useCallback((error: RuntimeError) => {
    dispatch({ type: "SET_RUNTIME_ERROR", runtimeError: error });
  }, []);

  const appendError = useCallback(
    (
      error: Error | unknown | RuntimeErrorEntry,
      resourceUri?: string,
      resourceName?: string,
    ) => {
      // If it's already a RuntimeErrorEntry, use it directly
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        "timestamp" in error
      ) {
        dispatch({
          type: "APPEND_RUNTIME_ERROR",
          error: error as RuntimeErrorEntry,
        });
        return;
      }

      // Otherwise, create a RuntimeErrorEntry from the error
      const isError = error instanceof Error;
      const runtimeError: RuntimeErrorEntry = {
        message: isError ? error.message : String(error),
        name: isError ? error.name : "Error",
        stack: isError ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        resourceUri,
        resourceName,
      };

      dispatch({ type: "APPEND_RUNTIME_ERROR", error: runtimeError });
    },
    [],
  );

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_RUNTIME_ERRORS" });
  }, []);

  const correlationIdRef = useRef<string | null>(null);

  // Track READ checkpoints by resource URI to create a pre-update version
  const readCheckpointRef = useRef<Map<string, string>>(new Map());
  const autoSendCompletedRef = useRef(false);
  const addVersion = useAddVersion();

  const mergedUiOptions = { ...DEFAULT_UI_OPTIONS, ...uiOptions };

  // Form state - for editing agent settings
  const form = useForm({
    defaultValues: initialAgent,
    resolver: zodResolver(AgentSchema),
  });

  // Current agent state - form values
  const agent = form.watch();

  const updateAgent = useCallback(
    (updates: Partial<Agent>) => {
      Object.entries(updates).forEach(([key, value]) => {
        form.setValue(key as keyof Agent, value, { shouldDirty: true });
      });
    },
    [form],
  );

  const saveAgent = useCallback(async () => {
    if (!onSave) {
      toast.error("No save handler provided");
      return;
    }

    try {
      await onSave(agent as Agent);
      form.reset(agent); // Reset form with current values to clear dirty state
    } catch (error) {
      toast.error("Failed to save agent");
      throw error;
    }
  }, [agent, onSave, form]);

  const resetAgent = useCallback(() => {
    form.reset(initialAgent);
  }, [form, initialAgent]);

  // Transport is now passed in as a prop

  // Initialize chat
  const chat = useChat({
    id: threadId,
    messages: initialMessages || [],
    transport,
    onFinish: (result) => {
      setIsLoading(false);

      const metadata = result?.message?.metadata as
        | { finishReason: LanguageModelV2FinishReason }
        | undefined;

      // Read finish reason from metadata attached by the backend
      const finishReason = metadata?.finishReason;

      const isCancelled =
        result.isAbort || result.isDisconnect || result.isError;

      if (isCancelled) {
        setFinishReason(null);
        return;
      }

      // Only set finish reason if it's one we care about displaying
      setFinishReason(
        finishReason === "length" || finishReason === "tool-calls"
          ? finishReason
          : null,
      );

      // Save messages to IndexedDB for persistence (reactive mutation)
      if (result?.messages) {
        const initialLength = initialMessages?.length ?? 0;
        const newMessages = result.messages.slice(initialLength);

        // Add agentId to assistant messages and userId to user messages
        const messagesWithMetadata = newMessages.map((msg) => {
          if (msg.role === "assistant") {
            const existingMetadata =
              msg.metadata && typeof msg.metadata === "object"
                ? msg.metadata
                : {};
            return {
              ...msg,
              metadata: { ...existingMetadata, agentId },
            };
          }
          // User messages already have userId in metadata when sent
          return msg;
        });

        if (messagesWithMetadata.length > 0) {
          appendMessagesMutation.mutate({
            threadId,
            messages: messagesWithMetadata,
            metadata: { agentId, route: pathname },
            namespace: locator,
          });
        }
      }

      // Send notification if user is not viewing the app
      if (
        "Notification" in window &&
        Notification.permission === "granted" &&
        !document.hasFocus()
      ) {
        // Get the last user message to show what they asked about
        const lastUserMessage = chat.messages.findLast(
          (msg) => msg.role === "user",
        );

        let userPrompt = "your task";
        if (lastUserMessage) {
          const messageText =
            "content" in lastUserMessage &&
            typeof lastUserMessage.content === "string"
              ? lastUserMessage.content
              : (lastUserMessage.parts
                  ?.map((p) => (p.type === "text" ? p.text : ""))
                  .join(" ") ?? "");

          // Truncate to first 60 characters for notification
          userPrompt =
            messageText.length > 60
              ? `"${messageText.substring(0, 60)}..."`
              : `"${messageText}"`;
        }

        // Play notification sound using preloaded audio
        // Play sound first, then show notification for better sync
        if (notificationAudio) {
          // Reset audio to beginning in case it was played before
          notificationAudio.currentTime = 0;
          notificationAudio.play().catch((error) => {
            console.warn("Failed to play notification sound:", error);
          });
        }

        const notification = new Notification("Task Finished", {
          body: `${userPrompt} is complete.`,
          icon: "/favicon.ico",
          tag: `chat-${threadId}`,
          requireInteraction: false,
        });

        // Focus the window when notification is clicked
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }

      // Broadcast resource updates when assistant message completes
      if (result?.message?.role === "assistant" && result.message.parts) {
        const toolDeps: HandleToolDeps = {
          readCheckpointRef,
          addVersion:
            addVersion as unknown as VersionHistoryActions["addVersion"],
          threadId,
        };

        for (const part of result.message.parts) {
          const info = normalizeToolPart(part);
          if (!info.isTool) continue;
          if (info.state !== "output-available" || !info.toolName) continue;
          handleReadCheckpointFromPart(info, toolDeps);
          handleUpdateOrCreateFromPart(info, toolDeps);

          // Auto-open resource tabs for resource operations
          const isResourceTool =
            isResourceUpdateOrCreateTool(info.toolName) ||
            isResourceReadTool(info.toolName);
          if (isResourceTool) {
            const resourceUri = extractResourceUri(
              info.toolName,
              info.args,
              info.output,
            );
            if (resourceUri) {
              openResourceTab(
                resourceUri,
                tabs,
                integrations,
                addTab,
                setActiveTab,
              );
            }
          }
        }
      }
    },
    onError: () => {
      setIsLoading(false);
      setFinishReason(null);
    },
    onToolCall: ({ toolCall }) => {
      // Trigger all registered tool call listeners
      triggerToolCallListeners(toolCall);

      // Handle RENDER tool
      if (toolCall.toolName === "RENDER") {
        const { content, title } = (toolCall.input ?? {}) as {
          content?: string;
          title?: string;
        };

        const isImageLike = content && IMAGE_REGEXP.test(content);

        if (!isImageLike) {
          openPreviewPanel(
            `preview-${toolCall.toolCallId}`,
            content || "",
            title || "",
          );
        }
      }

      // Handle theme updates - trigger UI reload immediately
      if (toolCall.toolName === "UPDATE_ORG_THEME") {
        const { org } = Locator.parse(locator);

        // Invalidate all org-theme and team-theme queries
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "org-theme" ||
            (query.queryKey[0] === "team-theme" && query.queryKey[1] === org),
        });

        // Force refetch the team theme immediately
        queryClient.refetchQueries({ queryKey: KEYS.ORG_THEME(org) });

        // Dispatch event for immediate UI update (same as save button)
        window.dispatchEvent(new CustomEvent("theme-updated"));
      }
    },
  });

  // Track unsaved changes for UI
  const hasUnsavedChanges = form.formState.isDirty;

  // Don't block navigation for well-known agents (they create new agents on save)
  const isWellKnownAgent = agentId in WELL_KNOWN_AGENTS;
  const shouldBlockNavigation = hasUnsavedChanges && !isWellKnownAgent;
  const blocked = useBlocker(shouldBlockNavigation);

  // Wrap sendMessage to enrich request metadata with all configuration
  const wrappedSendMessage = useCallback(
    (message?: UIMessage) => {
      // Get current agent ID from agent store
      const currentAgentId = useAgentStore.getState().agentId;

      // Early return if readOnly
      if (mergedUiOptions.readOnly) {
        return Promise.resolve();
      }

      // Set loading state
      setIsLoading(true);

      // If no message provided, send current input (form behavior)
      if (!message) {
        return chat.sendMessage?.() ?? Promise.resolve();
      }

      // Handle programmatic message send with metadata
      // Extract rules, resources, and tools from context items
      const contextItems = threadContextItems;

      // Extract rules from context items and convert to UIMessages for context (not persisted to thread)
      const rulesFromContextItems = contextItems
        .filter((item) => item.type === "rule")
        .map((item) => (item as { text: string }).text);

      // Extract resources from context items and convert to UIMessages for context
      const resourcesFromContextItems = contextItems
        .filter(
          (item) =>
            item.type === "resource" && item.resourceType === "DOCUMENT",
        )
        .map((item) => {
          const resource = item as {
            uri: string;
            name?: string;
            resourceType?: string;
          };
          // Format resource information as a system message
          const resourceInfo = [
            `Resource URI: ${resource.uri}`,
            ...(resource.name ? [`Resource Name: ${resource.name}`] : []),
            ...(resource.resourceType
              ? [`Resource Type: ${resource.resourceType}`]
              : []),
            `You can use resource tools to read, update, and work with this resource. The resource URI is: ${resource.uri}`,
          ].join("\n");
          return resourceInfo;
        });

      // Combine rules and resources into context messages
      const allContextTexts = [
        ...rulesFromContextItems,
        ...resourcesFromContextItems,
      ];

      const context: UIMessage[] | undefined =
        allContextTexts && allContextTexts.length > 0
          ? allContextTexts.map((text) => ({
              id: crypto.randomUUID(),
              role: "system" as const,
              parts: [
                {
                  type: "text" as const,
                  text,
                },
              ],
            }))
          : undefined;

      // Extract toolsets from context items
      const toolsFromContextItems = contextItems
        .filter((item) => item.type === "toolset")
        .reduce(
          (acc, item) => {
            const toolset = item as {
              integrationId: string;
              enabledTools: string[];
            };
            acc[toolset.integrationId] = toolset.enabledTools;
            return acc;
          },
          {} as Agent["tools_set"],
        );

      // If there are documents in context, add document reading tools
      const hasDocuments = resourcesFromContextItems.length > 0;
      if (hasDocuments) {
        const DOCUMENTS_INTEGRATION_ID = "i:documents-management";
        const documentTools = [
          "DECO_RESOURCE_DOCUMENT_READ",
          "DECO_RESOURCE_DOCUMENT_UPDATE",
        ];

        // Merge with existing tools if any, otherwise create new array
        if (toolsFromContextItems[DOCUMENTS_INTEGRATION_ID]) {
          // Merge tools, avoiding duplicates
          const existingTools = toolsFromContextItems[DOCUMENTS_INTEGRATION_ID];
          toolsFromContextItems[DOCUMENTS_INTEGRATION_ID] = [
            ...new Set([...existingTools, ...documentTools]),
          ];
        } else {
          toolsFromContextItems[DOCUMENTS_INTEGRATION_ID] = documentTools;
        }
      }

      // Get current user ID for user messages
      const userId = user?.id;

      const metadata: MessageMetadata = {
        // Agent configuration
        // Use user's selected model from preferences ONLY if model selector is shown in UI,
        // otherwise use the agent's configured model (important for actor agents)
        model: mergedUiOptions.showModelSelector
          ? preferences.defaultModel || agent.model
          : agent.model,
        instructions: agent.instructions,
        tools: { ...agent.tools_set, ...toolsFromContextItems },
        maxSteps: agent.max_steps,
        temperature: agent.temperature ?? undefined,
        lastMessages: agent.memory?.last_messages,
        maxTokens: agent.max_tokens !== null ? agent.max_tokens : undefined,
        // Use OpenRouter preference: if useOpenRouter is true, bypassOpenRouter should be false
        bypassOpenRouter: !preferences.useOpenRouter,

        // Context messages (additional context not persisted to thread)
        context,
        agentId: currentAgentId,
      };

      // Add userId and createdAt to user message metadata
      const existingMetadata =
        message.metadata && typeof message.metadata === "object"
          ? message.metadata
          : {};
      const messageWithMetadata: UIMessage = {
        ...message,
        metadata: {
          ...existingMetadata,
          userId,
          createdAt:
            (existingMetadata as { createdAt?: string })?.createdAt ??
            new Date().toISOString(),
        },
      };

      // Dispatch messages to track them
      dispatchMessages({
        messages: [messageWithMetadata],
        threadId,
        agentId: currentAgentId,
      });

      // Send message with metadata in options
      const sendPromise =
        chat.sendMessage?.(messageWithMetadata, { metadata }) ??
        Promise.resolve();

      return sendPromise;
    },
    [
      mergedUiOptions.readOnly,
      mergedUiOptions.showModelSelector,
      preferences.defaultModel,
      preferences.useOpenRouter,
      agent.model,
      agent.instructions,
      agent.tools_set,
      agent.max_steps,
      agent.temperature,
      agent.max_tokens,
      agent.memory?.last_messages,
      chat.sendMessage,
      chat.messages,
      threadId,
      agentId,
      pathname,
      setIsLoading,
      threadContextItems,
      user,
    ],
  );

  const handleRetry = useCallback(
    async (context?: string[]) => {
      const lastUserMessage = chat.messages.findLast(
        (msg) => msg.role === "user",
      );

      if (!lastUserMessage) return;

      const lastText =
        "content" in lastUserMessage &&
        typeof lastUserMessage.content === "string"
          ? lastUserMessage.content
          : (lastUserMessage.parts
              ?.map((p) => (p.type === "text" ? p.text : ""))
              .join(" ") ?? "");

      await wrappedSendMessage({
        role: "user",
        id: crypto.randomUUID(),
        parts: [
          { type: "text", text: lastText },
          ...(context?.map((c) => ({ type: "text" as const, text: c })) || []),
        ],
      });

      trackEvent("chat_retry", {
        data: { agentId, threadId, lastUserMessage: lastText },
      });
    },
    [chat.messages, wrappedSendMessage, agentId, threadId],
  );

  // Form reset is now handled by the key prop on the provider at a higher level
  // The provider is remounted when the thread changes, which naturally resets the form

  // Auto-send initialInput when autoSend is true (using lazy initialization)
  // This runs only once when the component mounts with autoSend=true
  useEffect(() => {
    if (autoSendCompletedRef.current) {
      return;
    }

    if (!autoSend || !input || !initialMessages) {
      return;
    }

    if (initialMessages.length > 0) {
      return;
    }

    autoSendCompletedRef.current = true;

    queueMicrotask(() => {
      wrappedSendMessage({
        role: "user",
        id: crypto.randomUUID(),
        parts: [{ type: "text", text: input }],
      });

      if (onAutoSendComplete) {
        startTransition(() => {
          onAutoSendComplete();
        });
      }
    });
  }, [
    autoSend,
    input,
    initialMessages,
    onAutoSendComplete,
    wrappedSendMessage,
  ]);

  // Format runtime error entries into a single error message (derived state)
  const formattedRuntimeError = useMemo((): RuntimeError | null => {
    if (runtimeErrorEntries.length === 0) {
      return null;
    }

    // Get context from the first error entry
    const firstError = runtimeErrorEntries[0];
    const resourceUri = firstError.resourceUri;
    const resourceName = firstError.resourceName || "unknown";

    // Format all errors into a summary
    const errorSummary = runtimeErrorEntries
      .map((error, index) => {
        const location = error.source
          ? `\n  Source: ${error.source}:${error.line}:${error.column}`
          : "";
        const stack = error.stack ? `\n  Stack: ${error.stack}` : "";
        return `${index + 1}. [${error.type || error.name}] ${error.message}${location}${stack}`;
      })
      .join("\n\n");

    const fullMessage = `The resource "${resourceName}" is encountering ${runtimeErrorEntries.length} error${runtimeErrorEntries.length > 1 ? "s" : ""}:\n\n${errorSummary}\n\nPlease help fix ${runtimeErrorEntries.length > 1 ? "these errors" : "this error"}.`;

    return {
      message: fullMessage,
      displayMessage: "App error found",
      errorCount: runtimeErrorEntries.length,
      context: {
        errorType: "runtime_errors",
        resourceUri,
        resourceName,
        errorCount: runtimeErrorEntries.length,
        errors: runtimeErrorEntries,
      },
    };
  }, [runtimeErrorEntries]);

  // Event listeners removed - components now use the useAgenticChat hook directly

  const contextValue: AgenticChatContextValue = {
    agent: agent as Agent,
    isDirty: hasUnsavedChanges,
    updateAgent,
    saveAgent,
    resetAgent,

    // Form state
    form: form as UseFormReturn<Agent>,

    // Chat state
    chat,
    finishReason,
    input,
    setInput,
    isLoading,

    // Chat methods
    sendMessage: wrappedSendMessage,
    retry: handleRetry,

    // Runtime error state
    runtimeError: formattedRuntimeError,
    runtimeErrorEntries,
    showError,
    appendError,
    clearError,

    // UI options
    uiOptions: mergedUiOptions,

    // Layout options
    forceBottomLayout,

    // Metadata
    metadata: {
      agentId,
      threadId,
    },

    // Refs
    correlationIdRef,
  };

  function handleCancel() {
    blocked.reset?.();
  }

  function discardChangesBlocked() {
    form.reset();
    blocked.proceed?.();
  }

  // Register sendMessage in global store so it can be accessed from outside the provider
  useEffect(() => {
    useChatStore.getState().setSendMessage(wrappedSendMessage);
    return () => {
      useChatStore.getState().setSendMessage(null);
    };
  }, [wrappedSendMessage]);

  return (
    <>
      <AlertDialog open={blocked.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you leave this page, your edits will
              be lost. Are you sure you want to discard your changes and
              navigate away?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={discardChangesBlocked}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AgenticChatContext.Provider value={contextValue}>
        {children}
      </AgenticChatContext.Provider>
    </>
  );
}

// Main hook for the AgenticChatProvider context
export function useAgenticChat() {
  const context = useContext(AgenticChatContext);
  if (!context) {
    throw new Error("useAgenticChat must be used within AgenticChatProvider");
  }
  return context;
}

function safeStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
