import { useCurrentOrganization } from "@/web/hooks/use-current-organization";
import { useLocalStorage } from "@/web/hooks/use-local-storage";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { useChat } from "@ai-sdk/react";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { DecoChatAside } from "@deco/ui/components/deco-chat-aside.tsx";
import { DecoChatEmptyState } from "@deco/ui/components/deco-chat-empty-state.tsx";
import { DecoChatInputV2 } from "@deco/ui/components/deco-chat-input-v2.tsx";
import { DecoChatMessage } from "@deco/ui/components/deco-chat-message.tsx";
import { DecoChatMessages } from "@deco/ui/components/deco-chat-messages.tsx";
import { DecoChatModelSelectorRich } from "@deco/ui/components/deco-chat-model-selector-rich.tsx";
import { DecoChatSkeleton } from "@deco/ui/components/deco-chat-skeleton.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { useChatThreads } from "@deco/ui/providers/chat-threads-provider.tsx";
import { ModelsBindingProvider } from "@deco/ui/providers/models-binding-provider.tsx";
import { useNavigate } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDecoChatOpen } from "@/web/hooks/use-deco-chat-open";
import { LOCALSTORAGE_KEYS } from "@/web/lib/localstorage-keys";
import { EmptyState } from "@/web/components/empty-state";
import { useBindingConnections } from "@/web/hooks/use-models-binding";
import { useModelsFromConnection } from "@/web/hooks/use-models";
import { useAgentsFromConnection } from "@/web/hooks/use-agents";

// Capybara avatar URL from decopilotAgent
const CAPYBARA_AVATAR_URL =
  "https://assets.decocache.com/decocms/fd07a578-6b1c-40f1-bc05-88a3b981695d/f7fc4ffa81aec04e37ae670c3cd4936643a7b269.png";

// Create transport for models stream API (stable across model changes)
function createModelsTransport(
  orgSlug: string,
): DefaultChatTransport<UIMessage> {
  return new DefaultChatTransport({
    api: `/api/${orgSlug}/models/stream`,
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

      return {
        body: {
          messages,
          model: metadata?.model,
          agent: metadata?.agent,
          stream: true,
        },
      };
    },
  });
}

export function DecoChatPanel() {
  const { locator, org } = useProjectContext();
  const { organization } = useCurrentOrganization();
  const orgSlug = organization?.slug || "";
  const { setOpen } = useDecoChatOpen();
  const navigate = useNavigate();

  // Use thread management from ChatThreadsProvider
  const {
    messages: threadMessages,
    addMessage,
    copyThreadTabs,
  } = useChatThreads();

  // Thread messages are already in UIMessage format
  const initialMessages = useMemo<UIMessage[]>(
    () => threadMessages,
    [threadMessages],
  );

  // Local state for input (similar to provider.tsx)
  const [input, setInput] = useState("");

  // Sentinel ref for auto-scrolling to bottom
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Get first connection that implements MODELS binding
  const {
    connections: modelsConnections,
    isLoading: modelsConnectionsLoading,
    error: modelsBindingError,
  } = useBindingConnections("MODELS");
  const modelsConnection = modelsConnections[0];

  // Get first connection that implements AGENTS binding
  const {
    connections: agentsConnections,
    isLoading: agentsConnectionsLoading,
  } = useBindingConnections("AGENTS");
  const agentsConnection = agentsConnections[0];

  // Fetch models from the first MODELS connection
  const { data: modelsData, isPending: modelsLoading } =
    useModelsFromConnection(modelsConnection?.id);

  // Fetch agents from the first AGENTS connection
  const { data: agentsData, isPending: agentsLoading } =
    useAgentsFromConnection(agentsConnection?.id);

  const isModelsLoading = modelsConnectionsLoading || modelsLoading;
  const isAgentsLoading = agentsConnectionsLoading || agentsLoading;

  // Transform models for UI display
  const models = useMemo(() => {
    if (!modelsData || !modelsConnection) return [];

    // Provider logo mapping
    const providerLogos: Record<string, string> = {
      anthropic:
        "https://api.dicebear.com/7.x/initials/svg?seed=Anthropic&backgroundColor=D97706",
      openai:
        "https://api.dicebear.com/7.x/initials/svg?seed=OpenAI&backgroundColor=10B981",
      google:
        "https://api.dicebear.com/7.x/initials/svg?seed=Google&backgroundColor=3B82F6",
      "x-ai":
        "https://api.dicebear.com/7.x/initials/svg?seed=xAI&backgroundColor=8B5CF6",
    };

    // Known visual capabilities to show
    const knownCapabilities = new Set([
      "reasoning",
      "image-upload",
      "file-upload",
      "web-search",
    ]);

    return modelsData.map((model) => {
      // Extract provider from model id (e.g., "anthropic/claude-3.5-sonnet" → "anthropic")
      const provider = model.id.split("/")[0] || "";
      const logo = model.logo || providerLogos[provider] || null;

      // Filter capabilities to only show known visual ones
      const capabilities = model.capabilities.filter((cap) =>
        knownCapabilities.has(cap),
      );

      // Convert costs from per-token to per-1M-tokens (multiply by 1,000,000)
      const inputCost = model.costs?.input
        ? model.costs.input * 1_000_000
        : null;
      const outputCost = model.costs?.output
        ? model.costs.output * 1_000_000
        : null;

      return {
        id: model.id,
        model: model.title,
        name: model.title,
        logo,
        description: model.description,
        capabilities,
        inputCost,
        outputCost,
        contextWindow: model.limits?.contextWindow ?? null,
        outputLimit: model.limits?.maxOutputTokens ?? null,
        provider: model.provider,
        endpoint: model.endpoint,
        connectionId: modelsConnection.id,
        connectionName: modelsConnection.title,
      };
    });
  }, [modelsData, modelsConnection]);

  // Transform agents with connection info
  const agents = useMemo(() => {
    if (!agentsData || !agentsConnection) return [];

    return agentsData.map((agent) => ({
      ...agent,
      connectionId: agentsConnection.id,
      connectionName: agentsConnection.title,
    }));
  }, [agentsData, agentsConnection]);

  // Persist selected model (including connectionId) per organization in localStorage
  const [selectedModelState, setSelectedModelState] = useLocalStorage<{
    modelId: string;
    connectionId: string;
  } | null>(
    LOCALSTORAGE_KEYS.chatSelectedModel(locator),
    (existing) => existing as { modelId: string; connectionId: string } | null,
  );

  // Persist selected agent per organization in localStorage
  const [selectedAgentState, setSelectedAgentState] = useLocalStorage<{
    agentId: string;
    connectionId: string;
  } | null>(`${locator}:selected-agent`, () => null);

  // Initialize with first model
  useEffect(() => {
    if (models.length > 0 && !selectedModelState) {
      const firstModel = models[0];
      if (firstModel) {
        setSelectedModelState({
          modelId: firstModel.id,
          connectionId: firstModel.connectionId,
        });
      }
    }
  }, [models, selectedModelState, setSelectedModelState]);

  // Get selected model info
  const selectedModel = useMemo(
    () =>
      models.find(
        (m) =>
          m.id === selectedModelState?.modelId &&
          m.connectionId === selectedModelState?.connectionId,
      ),
    [models, selectedModelState],
  );

  // Get selected agent info
  const selectedAgent = useMemo(
    () =>
      agents.find(
        (a) =>
          a.id === selectedAgentState?.agentId &&
          a.connectionId === selectedAgentState?.connectionId,
      ),
    [agents, selectedAgentState],
  );

  // Create transport (stable, doesn't depend on selected model)
  const transport = useMemo(() => createModelsTransport(orgSlug), [orgSlug]);

  // Use AI SDK's useChat hook
  const chat = useChat({
    id: `mesh-chat-${orgSlug}`,
    messages: initialMessages,
    transport: transport ?? undefined,
    onFinish: (result) => {
      // Save new messages to thread provider (similar to provider.tsx)
      if (result?.messages) {
        const initialLength = initialMessages?.length ?? 0;
        const newMessages = result.messages.slice(initialLength);

        if (newMessages.length > 0) {
          newMessages.forEach((msg: UIMessage) => {
            // Skip non-chat roles (data messages)
            if (
              msg.role !== "user" &&
              msg.role !== "assistant" &&
              msg.role !== "system"
            ) {
              return;
            }

            // Add UIMessage directly to thread (without id, it will be generated)
            const { id: _id, ...messageWithoutId } = msg;
            addMessage(messageWithoutId);
          });
        }
      }
    },
    onError: (error: Error) => {
      console.error("[deco-chat] Chat error:", error);
    },
  });

  // Derive loading state from chat status
  const isLoading = chat.status === "submitted" || chat.status === "streaming";

  const isEmpty = chat.messages.length === 0;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (sentinelRef.current && chat.messages.length > 0) {
      sentinelRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [chat.messages]);

  // ModelsBindingProvider value - use modelId for backward compat
  const modelsBindingValue = useMemo(
    () => ({
      models,
      selectedModel: selectedModelState?.modelId,
      setSelectedModel: (modelId: string) => {
        const model = models.find((m) => m.id === modelId);
        if (model) {
          setSelectedModelState({
            modelId: model.id,
            connectionId: model.connectionId,
          });
        }
      },
      isLoading: isModelsLoading,
      error: modelsBindingError as Error | undefined,
    }),
    [
      models,
      selectedModelState?.modelId,
      isModelsLoading,
      modelsBindingError,
      setSelectedModelState,
    ],
  );

  // Wrapped send message - enriches request with metadata (similar to provider.tsx)
  const wrappedSendMessage = useCallback(
    async (message: UIMessage) => {
      if (!selectedModelState || !selectedModel?.endpoint) {
        console.error("No model or endpoint configured");
        return;
      }

      // Prepare metadata with model and agent configuration
      const metadata: {
        model: { id: string; connectionId: string; provider?: string | null };
        agent?: {
          id: string;
          instructions: string;
          tool_set: Record<string, string[]>;
        };
      } = {
        model: {
          id: selectedModelState.modelId,
          connectionId: selectedModelState.connectionId,
          provider: selectedModel.provider,
        },
      };

      // Add agent if selected
      if (selectedAgent) {
        metadata.agent = {
          id: selectedAgent.id,
          instructions: selectedAgent.instructions,
          tool_set: selectedAgent.tool_set,
        };
      }

      return await chat.sendMessage(message, { metadata });
    },
    [chat, selectedModelState, selectedModel, selectedAgent],
  );

  const handleSendMessage = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!input?.trim() || isLoading) {
        return;
      }

      // Create and send message with metadata
      const userMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: input }],
      };

      setInput("");
      // Use the wrapped send message function
      await wrappedSendMessage(userMessage);
    },
    [input, isLoading, wrappedSendMessage],
  );

  const handleStop = useCallback(() => {
    chat.stop?.();
  }, [chat]);

  // Show skeleton while loading connections
  if (isModelsLoading || isAgentsLoading) {
    return <DecoChatSkeleton />;
  }

  // Check if both required bindings are present
  const hasModelsBinding = modelsConnections.length > 0;
  const hasAgentsBinding = agentsConnections.length > 0;
  const hasBothBindings = hasModelsBinding && hasAgentsBinding;

  // If missing bindings, show empty state with appropriate message
  if (!hasBothBindings) {
    let title: string;
    let description: string;

    if (!hasModelsBinding && !hasAgentsBinding) {
      title = "Connect your providers";
      description =
        "Add MCPs with MODELS and AGENTS to unlock AI-powered features.";
    } else if (!hasModelsBinding) {
      title = "No model provider connected";
      description =
        "Connect to a model provider to unlock AI-powered features.";
    } else {
      title = "No agents configured";
      description = "Connect to an agents provider to use AI assistants.";
    }

    return (
      <DecoChatAside className="h-full">
        <DecoChatAside.Header>
          <div className="flex items-center gap-2">
            <img
              src={CAPYBARA_AVATAR_URL}
              alt="deco chat"
              className="size-5 rounded"
            />
            <span className="text-sm font-medium">deco chat</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-6 items-center justify-center rounded-full p-1 hover:bg-transparent transition-colors group cursor-pointer"
              title="Close chat"
            >
              <Icon
                name="close"
                size={16}
                className="text-muted-foreground group-hover:text-foreground transition-colors"
              />
            </button>
          </div>
        </DecoChatAside.Header>
        <DecoChatAside.Content className="flex flex-col items-center">
          <EmptyState
            title={title}
            description={description}
            actions={
              <Button
                variant="outline"
                onClick={() =>
                  navigate({
                    to: "/$org/mcps",
                    params: { org },
                    search: { action: "create" },
                  })
                }
              >
                Add connection
              </Button>
            }
          />
        </DecoChatAside.Content>
      </DecoChatAside>
    );
  }

  return (
    <ModelsBindingProvider value={modelsBindingValue}>
      <DecoChatAside className="h-full">
        <DecoChatAside.Header>
          <div className="flex items-center gap-2">
            <img
              src={selectedAgent?.avatar || CAPYBARA_AVATAR_URL}
              alt="deco chat"
              className="size-5 rounded"
            />
            <span className="text-sm font-medium">
              {selectedAgent?.title || "deco chat"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {!isEmpty && (
              <button
                type="button"
                onClick={() => {
                  // Create new thread (copies tabs from current)
                  copyThreadTabs();
                }}
                className="flex size-6 items-center justify-center rounded-full p-1 hover:bg-transparent group cursor-pointer"
                title="New chat"
              >
                <Icon
                  name="add"
                  size={16}
                  className="text-muted-foreground group-hover:text-foreground transition-colors"
                />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-6 items-center justify-center rounded-full p-1 hover:bg-transparent transition-colors group cursor-pointer"
              title="Close chat"
            >
              <Icon
                name="close"
                size={16}
                className="text-muted-foreground group-hover:text-foreground transition-colors"
              />
            </button>
          </div>
        </DecoChatAside.Header>

        <DecoChatAside.Content>
          {modelsBindingError && (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertDescription>
                  {(modelsBindingError as Error).message}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {isEmpty ? (
            <DecoChatEmptyState
              title={selectedAgent?.title || "Ask deco chat"}
              description={
                selectedAgent?.description ||
                "Ask anything about configuring model providers or using MCP Mesh."
              }
              avatar={selectedAgent?.avatar || "/img/logo-tiny.svg"}
            />
          ) : (
            <DecoChatMessages>
              {chat.messages.map((message: UIMessage, index: number) => (
                <DecoChatMessage
                  key={message.id}
                  message={message}
                  timestamp={new Date().toISOString()}
                  isStreaming={isLoading && index === chat.messages.length - 1}
                />
              ))}
              {/* Sentinel element for smooth scrolling to bottom */}
              <div ref={sentinelRef} className="h-0" />
            </DecoChatMessages>
          )}
        </DecoChatAside.Content>

        <DecoChatAside.Footer>
          <DecoChatInputV2
            value={input}
            onChange={setInput}
            onSubmit={handleSendMessage}
            onStop={handleStop}
            disabled={models.length === 0 || !selectedModelState}
            isStreaming={isLoading}
            placeholder={
              models.length === 0
                ? "Add a MODELS binding connection to start chatting"
                : "Ask anything or @ for context"
            }
            rightActions={
              <div className="flex items-center gap-1">
                {/* Agent Selector */}
                {agents.length > 0 && (
                  <Select
                    value={
                      selectedAgentState
                        ? `${selectedAgentState.connectionId}:${selectedAgentState.agentId}`
                        : "__none__"
                    }
                    onValueChange={(value) => {
                      if (value === "__none__") {
                        setSelectedAgentState(null);
                      } else {
                        const [connectionId, agentId] = value.split(":");
                        setSelectedAgentState({ agentId, connectionId });
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 w-auto min-w-[80px] text-xs border-0 bg-transparent hover:bg-accent px-2">
                      <SelectValue placeholder="Agent">
                        {selectedAgent ? (
                          <div className="flex items-center gap-1">
                            <img
                              src={selectedAgent.avatar}
                              alt={selectedAgent.title}
                              className="size-4 rounded"
                            />
                            <span className="truncate max-w-[60px]">
                              {selectedAgent.title}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Agent</span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">No agent</span>
                      </SelectItem>
                      {agents.map((agent) => (
                        <SelectItem
                          key={`${agent.connectionId}:${agent.id}`}
                          value={`${agent.connectionId}:${agent.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={agent.avatar}
                              alt={agent.title}
                              className="size-5 rounded"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm">{agent.title}</span>
                              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {agent.description}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {/* Model Selector */}
                <DecoChatModelSelectorRich />
              </div>
            }
          />
        </DecoChatAside.Footer>
      </DecoChatAside>
    </ModelsBindingProvider>
  );
}
