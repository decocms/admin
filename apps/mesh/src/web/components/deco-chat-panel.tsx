import type { MCPConnection } from "@/storage/types";
import { createConnectionToolCaller, fetcher } from "@/tools/client";
import { useCurrentOrganization } from "@/web/hooks/use-current-organization";
import { useLocalStorage } from "@/web/hooks/use-local-storage";
import { useOrganizationSettings } from "@/web/hooks/use-organization-settings";
import { KEYS } from "@/web/lib/query-keys";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { useChat } from "@ai-sdk/react";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { DecoChatAside } from "@deco/ui/components/deco-chat-aside.tsx";
import { DecoChatEmptyState } from "@deco/ui/components/deco-chat-empty-state.tsx";
import { DecoChatInputV2 } from "@deco/ui/components/deco-chat-input-v2.tsx";
import { DecoChatMessage } from "@deco/ui/components/deco-chat-message.tsx";
import { DecoChatMessages } from "@deco/ui/components/deco-chat-messages.tsx";
import { DecoChatModelSelectorRich } from "@deco/ui/components/deco-chat-model-selector-rich.tsx";
import { DecoChatSkeleton } from "@deco/ui/components/deco-chat-skeleton.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useChatThreads } from "@deco/ui/providers/chat-threads-provider.tsx";
import { ModelsBindingProvider } from "@deco/ui/providers/models-binding-provider.tsx";
import { useQuery } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDecoChatOpen } from "@/web/hooks/use-deco-chat-open";
import { LOCALSTORAGE_KEYS } from "@/web/lib/localstorage-keys";

// Model type matching ModelSchema from @decocms/bindings
interface Model {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  logo: string | null;
  description: string | null;
  capabilities: string[];
  limits: {
    contextWindow: number;
    maxOutputTokens: number;
  } | null;
  costs: {
    input: number;
    output: number;
  } | null;
  provider:
    | "openai"
    | "anthropic"
    | "google"
    | "xai"
    | "deepseek"
    | "openai-compatible"
    | null;
  endpoint: {
    url: string;
    method: string;
    contentType: string;
    stream: boolean;
  } | null;
}

interface ModelsResponse {
  models: Model[];
}

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
          modelId: metadata?.modelId,
          provider: metadata?.provider,
          endpoint: metadata?.endpoint,
          stream: true,
        },
      };
    },
  });
}

export function DecoChatPanel() {
  const { locator } = useProjectContext();
  const { organization } = useCurrentOrganization();
  const orgSlug = organization?.slug || "";
  const { setOpen } = useDecoChatOpen();

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

  const settingsQuery = useOrganizationSettings(organization?.id);

  const connectionsQuery = useQuery({
    queryKey: KEYS.connectionsByBinding(locator, "MODELS"),
    queryFn: async () => {
      return (await fetcher.CONNECTION_LIST({
        binding: "MODELS",
      })) as { connections: MCPConnection[] };
    },
    enabled: Boolean(locator),
    staleTime: 30_000,
  });

  const connection = useMemo(() => {
    if (!connectionsQuery.data?.connections || !settingsQuery.data) {
      return undefined;
    }

    const connectionId = settingsQuery.data.modelsBindingConnectionId;
    if (!connectionId) {
      return undefined;
    }

    const found = connectionsQuery.data.connections.find(
      (item) => item.id === connectionId,
    );
    return found;
  }, [connectionsQuery.data, settingsQuery.data]);

  const modelsQuery = useQuery({
    queryKey: KEYS.modelsList(orgSlug),
    enabled: Boolean(orgSlug) && Boolean(connection),
    staleTime: 30_000,
    queryFn: async () => {
      if (!connection) {
        throw new Error("No connection available");
      }

      const callTool = createConnectionToolCaller(connection.id);
      const result = await callTool("DECO_COLLECTION_MODELS_LIST", {});

      return {
        models: result?.items ?? [],
      } as ModelsResponse;
    },
  });

  // Transform models: add logos, convert costs, filter capabilities
  const models = useMemo(() => {
    if (!modelsQuery.data?.models) return [];

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

    return modelsQuery.data.models.map((model: Model) => {
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
        provider: model.provider, // Include provider type
        endpoint: model.endpoint, // Include endpoint for completions API
      };
    });
  }, [modelsQuery.data]);

  // Persist selected model per organization in localStorage
  const [selectedModelId, setSelectedModelId] = useLocalStorage<
    string | undefined
  >(LOCALSTORAGE_KEYS.chatSelectedModel(locator), (existing) => existing);

  // Initialize with first model
  useEffect(() => {
    if (models.length > 0 && !selectedModelId) {
      const firstModel = models[0];
      if (firstModel) {
        setSelectedModelId(firstModel.id);
      }
    }
  }, [models, selectedModelId, setSelectedModelId]);

  // Get selected model info
  const selectedModel = useMemo(
    () => models.find((m) => m.id === selectedModelId),
    [models, selectedModelId],
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

  // ModelsBindingProvider value
  const modelsBindingValue = useMemo(
    () => ({
      models,
      selectedModel: selectedModelId,
      setSelectedModel: setSelectedModelId,
      isLoading: modelsQuery.isLoading,
      error: modelsQuery.error as Error | undefined,
    }),
    [
      models,
      selectedModelId,
      modelsQuery.isLoading,
      modelsQuery.error,
      setSelectedModelId,
    ],
  );

  // Wrapped send message - enriches request with metadata (similar to provider.tsx)
  const wrappedSendMessage = useCallback(
    async (message: UIMessage) => {
      if (!selectedModelId || !selectedModel?.endpoint) {
        console.error("No model or endpoint configured");
        return;
      }

      // Prepare metadata with current model configuration
      const metadata = {
        modelId: selectedModelId,
        provider: selectedModel.provider,
        endpoint: selectedModel.endpoint,
      };

      return await chat.sendMessage(message, { metadata });
    },
    [chat, selectedModelId, selectedModel],
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
    [input, isLoading, selectedModelId, wrappedSendMessage],
  );

  const handleStop = useCallback(() => {
    chat.stop?.();
  }, [chat]);

  // Show skeleton while loading models
  if (modelsQuery.isLoading) {
    return <DecoChatSkeleton />;
  }

  return (
    <ModelsBindingProvider value={modelsBindingValue}>
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
          {modelsQuery.error && (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertDescription>
                  {(modelsQuery.error as Error).message}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {!modelsQuery.isLoading && models.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">
              The configured Models Provider isn't returning any models. Review
              it under Settings → Models Provider; no extra setup is required
              inside this chat.
            </div>
          )}

          {isEmpty ? (
            <DecoChatEmptyState
              title="Ask deco chat"
              description="Ask anything about configuring model providers or using MCP Mesh. The assistant uses the Models Provider configured in Settings for this organization."
              avatar="/img/logo-tiny.svg"
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
            disabled={models.length === 0 || !selectedModelId}
            isStreaming={isLoading}
            placeholder={
              models.length === 0
                ? "Configure a Models Provider in Settings to start chatting"
                : "Ask anything or @ for context"
            }
            rightActions={<DecoChatModelSelectorRich />}
          />
        </DecoChatAside.Footer>
      </DecoChatAside>
    </ModelsBindingProvider>
  );
}
