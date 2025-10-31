import type { LanguageModelV2FinishReason } from "@ai-sdk/provider";
import type { UIMessage } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import {
  AgentSchema,
  appendThreadMessage,
  DECO_CMS_API_URL,
  dispatchMessages,
  getTraceDebugId,
  KEYS,
  Locator,
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
import { notifyResourceUpdate } from "../../lib/broadcast-channels.ts";
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
import { IMAGE_REGEXP, openPreviewPanel } from "../chat/utils/preview.ts";
import { useThreadContext } from "../decopilot/thread-context-provider.tsx";
import { useDecopilotThread } from "../decopilot/thread-context.tsx";
import { useThreadManager } from "../decopilot/thread-manager-context.tsx";
import type { ContextItem } from "./types.ts";

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
  agentRoot: string; // Required agent root path
  onSave?: (agent: Agent) => Promise<void>;

  // Chat options
  initialMessages?: UIMessage[];
  initialInput?: string;
  autoSend?: boolean;
  onAutoSendComplete?: () => void;

  // User preferences
  model?: string;
  useOpenRouter?: boolean;
  sendReasoning?: boolean;
  useDecopilotAgent?: boolean;

  // UI options
  uiOptions?: Partial<UiOptions>;

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
  sendTextMessage: (text: string, context?: Record<string, unknown>) => void;
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

  // Metadata
  metadata: {
    agentId: string;
    threadId: string;
    agentRoot: string;
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
  output?: { structuredContent?: { data?: unknown; uri?: string } };
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
    | { structuredContent?: { data?: unknown; uri?: string } }
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
  const sc = info.output?.structuredContent;
  const readData = sc?.data;
  const fallbackUri = sc?.uri;
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

// Standalone functions that dispatch events for components outside the provider
export function sendTextMessage(
  text: string,
  context?: Record<string, unknown>,
) {
  window.dispatchEvent(
    new CustomEvent("decopilot:sendTextMessage", {
      detail: { text, context },
    }),
  );
}

export function createNewThreadWithMessage(
  message: string,
  contextItems?: ContextItem[],
) {
  window.dispatchEvent(
    new CustomEvent("decopilot:createNewThreadWithMessage", {
      detail: { message, contextItems },
    }),
  );
}

export function appendRuntimeError(
  error: Error | unknown | RuntimeErrorEntry,
  resourceUri?: string,
  resourceName?: string,
) {
  // If it's already a RuntimeErrorEntry, use it directly
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    "timestamp" in error
  ) {
    window.dispatchEvent(
      new CustomEvent("decopilot:appendError", {
        detail: error,
      }),
    );
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

  window.dispatchEvent(
    new CustomEvent("decopilot:appendError", {
      detail: runtimeError,
    }),
  );
}

export function clearRuntimeError() {
  window.dispatchEvent(new CustomEvent("decopilot:clearError"));
}

export function AgenticChatProvider({
  agentId,
  threadId,
  agent: initialAgent,
  agentRoot,
  onSave,
  initialMessages,
  initialInput,
  autoSend,
  onAutoSendComplete,
  model: defaultModel,
  useOpenRouter,
  sendReasoning,
  useDecopilotAgent,
  uiOptions,
  children,
}: PropsWithChildren<AgenticChatProviderProps>) {
  const { pathname } = useLocation();
  const { contextItems: threadContextItems, setContextItems } =
    useThreadContext();
  const triggerToolCallListeners = useTriggerToolCallListeners();
  const queryClient = useQueryClient();
  const { locator } = useSDK();
  const { createNewThread } = useThreadManager();
  const { setThreadState } = useDecopilotThread();

  const [state, dispatch] = useReducer(chatStateReducer, {
    finishReason: null,
    isLoading: false,
    input: initialInput || "",
    runtimeError: null,
    runtimeErrorEntries: [],
  });

  const { finishReason, isLoading, input, runtimeError, runtimeErrorEntries } =
    state;

  const setIsLoading = useCallback((value: boolean) => {
    dispatch({ type: "SET_IS_LOADING", isLoading: value });
  }, []);

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

  // Memoize the transport to prevent unnecessary re-creation
  const transport = useMemo(() => {
    // Use new Decopilot streaming endpoint if preference is enabled
    if (useDecopilotAgent) {
      return new DefaultChatTransport({
        api: new URL(`${locator}/agents/decopilot/stream`, DECO_CMS_API_URL)
          .href,
        credentials: "include",
        prepareSendMessagesRequest: ({
          messages,
          requestMetadata,
        }: {
          messages: UIMessage[];
          requestMetadata?: unknown;
        }) => {
          // Parse requestMetadata to extract values
          // oxlint-disable-next-line no-explicit-any
          const metadata = requestMetadata as any;
          const modelId = metadata?.model || defaultModel;
          const useOpenRouterValue = metadata?.bypassOpenRouter === false; // bypassOpenRouter: false means use OpenRouter

          return {
            body: {
              messages,
              model: {
                id: modelId,
                useOpenRouter: useOpenRouterValue,
              },
              temperature: metadata?.temperature,
              maxOutputTokens: metadata?.maxTokens,
              maxStepCount: metadata?.maxSteps,
              maxWindowSize: metadata?.lastMessages,
              system: metadata?.instructions,
              context: metadata?.context,
              tools: metadata?.tools,
              threadId: threadId ?? agentId,
            },
          };
        },
      });
    }

    // Use original actor-based streaming for regular agents
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
  }, [useDecopilotAgent, locator, agentRoot, threadId, agentId, defaultModel]);

  // Initialize chat
  const chat = useChat({
    messages: initialMessages || [],
    id: threadId,
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
      if (finishReason === "length" || finishReason === "tool-calls") {
        setFinishReason(finishReason);
      } else {
        setFinishReason(null);
      }

      // Save messages to IndexedDB when decopilot transport is active
      if (useDecopilotAgent && result?.messages) {
        const initialLength = initialMessages?.length ?? 0;
        const newMessages = result.messages.slice(initialLength);

        if (newMessages.length > 0) {
          appendThreadMessage(
            threadId,
            newMessages,
            { agentId, route: pathname },
            locator,
          ).catch((error) => {
            console.error(
              "[AgenticChatProvider] Failed to append messages to IndexedDB:",
              error,
            );
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

        const notification = new Notification("Task Finished", {
          body: `${userPrompt} is complete.`,
          icon: "/favicon.ico",
          tag: `chat-${threadId}`,
          requireInteraction: false,
        });

        // Play notification sound
        const audio = new Audio("/notification.mp3");
        audio.play().catch((error) => {
          console.warn("Failed to play notification sound:", error);
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
        }
      }
    },
    onError: (error) => {
      console.error("Chat error:", error);
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

      // Screenshot tooling removed

      // Resource update handling moved to onFinish
    },
  });

  // Track unsaved changes for UI
  const hasUnsavedChanges = form.formState.isDirty;

  // Don't block navigation for well-known agents (they create new agents on save)
  const isWellKnownAgent = Boolean(
    WELL_KNOWN_AGENTS[agentId as keyof typeof WELL_KNOWN_AGENTS],
  );
  const shouldBlockNavigation = hasUnsavedChanges && !isWellKnownAgent;
  const blocked = useBlocker(shouldBlockNavigation);

  // Wrap sendMessage to enrich request metadata with all configuration
  const wrappedSendMessage = useCallback(
    (message?: UIMessage) => {
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
      // Extract rules and tools from context items
      const contextItems = threadContextItems;

      // Extract rules from context items and convert to UIMessages for context (not persisted to thread)
      const rulesFromContextItems = contextItems
        .filter((item) => item.type === "rule")
        .map((item) => (item as { text: string }).text);

      const context: UIMessage[] | undefined =
        rulesFromContextItems && rulesFromContextItems.length > 0
          ? rulesFromContextItems.map((rule) => ({
              id: crypto.randomUUID(),
              role: "system" as const,
              parts: [
                {
                  type: "text" as const,
                  text: rule,
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

      const metadata: MessageMetadata = {
        // Agent configuration
        model: mergedUiOptions.showModelSelector ? defaultModel : agent.model,
        instructions: agent.instructions,
        tools: { ...agent.tools_set, ...toolsFromContextItems },
        maxSteps: agent.max_steps,
        temperature: agent.temperature !== null ? agent.temperature : undefined,
        lastMessages: agent.memory?.last_messages,
        maxTokens: agent.max_tokens !== null ? agent.max_tokens : undefined,

        // User preferences
        bypassOpenRouter: !useOpenRouter,
        sendReasoning: sendReasoning ?? true,

        // Context messages (additional context not persisted to thread)
        context: context,
      };

      // Dispatch messages to track them
      dispatchMessages({
        messages: [message],
        threadId: threadId,
        agentId: agentId,
      });

      // Send message with metadata in options
      return chat.sendMessage?.(message, { metadata }) ?? Promise.resolve();
    },
    [
      mergedUiOptions.readOnly,
      mergedUiOptions.showModelSelector,
      defaultModel,
      useOpenRouter,
      sendReasoning,
      useDecopilotAgent,
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

  const sendTextMessage = useCallback(
    (text: string) => {
      if (typeof text === "string" && text.trim()) {
        wrappedSendMessage({
          role: "user",
          id: crypto.randomUUID(),
          parts: [{ type: "text", text }],
        });
      }
    },
    [wrappedSendMessage],
  );

  // Only reset if form is not dirty (no unsaved changes)
  useEffect(() => {
    if (!form.formState.isDirty) {
      form.reset(initialAgent);
    }
  }, [initialAgent, form]);

  // Auto-send initialInput when autoSend is true
  useEffect(() => {
    if (autoSend && input && chat.messages.length === 0) {
      wrappedSendMessage({
        role: "user",
        id: crypto.randomUUID(),
        parts: [{ type: "text", text: input }],
      });
      onAutoSendComplete?.();
    }
  }, [
    autoSend,
    input,
    chat.messages.length,
    onAutoSendComplete,
    wrappedSendMessage,
  ]);

  // Format runtime error entries into a single error message
  useEffect(() => {
    if (runtimeErrorEntries.length > 0) {
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

      const formattedError = {
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

      // Dispatch directly to avoid dependency loop with showError
      dispatch({ type: "SET_RUNTIME_ERROR", runtimeError: formattedError });
    } else {
      // Clear error if no entries remain
      dispatch({ type: "SET_RUNTIME_ERROR", runtimeError: null });
    }
  }, [runtimeErrorEntries]);

  // Listen for events from components outside the provider
  useEffect(() => {
    function handleSendTextMessage(event: Event) {
      const customEvent = event as CustomEvent<{
        text: string;
        context?: Record<string, unknown>;
      }>;

      const { text } = customEvent.detail;

      if (typeof text === "string" && text.trim()) {
        wrappedSendMessage({
          role: "user",
          id: crypto.randomUUID(),
          parts: [{ type: "text", text }],
        });
      }
    }

    function handleSendMessage(event: Event) {
      const customEvent = event as CustomEvent<{
        message: UIMessage;
      }>;

      const { message } = customEvent.detail;

      if (message && message.parts && message.parts.length > 0) {
        wrappedSendMessage(message);
      }
    }

    function handleAppendError(event: Event) {
      const customEvent = event as CustomEvent<RuntimeErrorEntry>;
      appendError(customEvent.detail);
    }

    function handleClearError() {
      clearError();
    }

    function handleShowError(event: Event) {
      const customEvent = event as CustomEvent<RuntimeError>;

      const { message, displayMessage, errorCount, context } =
        customEvent.detail;

      if (typeof message === "string" && message.trim()) {
        showError({ message, displayMessage, errorCount, context });
      }
    }

    function handleCreateNewThreadWithMessage(event: Event) {
      const customEvent = event as CustomEvent<{
        message: string;
        contextItems: ContextItem[];
      }>;
      const { message, contextItems } = customEvent.detail;

      if (typeof message === "string" && message.trim()) {
        if (contextItems && contextItems.length > 0) {
          setContextItems(contextItems);
        }
        const threadId = crypto.randomUUID();

        setThreadState({
          initialMessage: message,
          autoSend: false,
          threadId,
        });
        createNewThread(pathname, agentId, threadId);
      }
    }

    window.addEventListener("decopilot:sendTextMessage", handleSendTextMessage);
    window.addEventListener("decopilot:sendMessage", handleSendMessage);
    window.addEventListener("decopilot:appendError", handleAppendError);
    window.addEventListener("decopilot:clearError", handleClearError);
    window.addEventListener("decopilot:showError", handleShowError);
    window.addEventListener(
      "decopilot:createNewThreadWithMessage",
      handleCreateNewThreadWithMessage,
    );

    return () => {
      window.removeEventListener(
        "decopilot:sendTextMessage",
        handleSendTextMessage,
      );
      window.removeEventListener("decopilot:sendMessage", handleSendMessage);
      window.removeEventListener("decopilot:appendError", handleAppendError);
      window.removeEventListener("decopilot:clearError", handleClearError);
      window.removeEventListener("decopilot:showError", handleShowError);
      window.removeEventListener(
        "decopilot:createNewThreadWithMessage",
        handleCreateNewThreadWithMessage,
      );
    };
  }, [
    pathname,
    agentId,
    showError,
    clearError,
    appendError,
    wrappedSendMessage,
    setContextItems,
    createNewThreadWithMessage,
    createNewThread,
    setThreadState,
  ]);

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
    sendTextMessage,
    retry: handleRetry,

    // Runtime error state
    runtimeError,
    runtimeErrorEntries,
    showError,
    appendError,
    clearError,

    // UI options
    uiOptions: mergedUiOptions,

    // Metadata
    metadata: {
      agentId,
      threadId,
      agentRoot,
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
