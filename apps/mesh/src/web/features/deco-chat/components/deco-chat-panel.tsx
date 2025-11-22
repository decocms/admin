import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MCPConnection } from "@/storage/types";
import { fetcher } from "@/tools/client";
import { KEYS } from "@/web/lib/query-keys";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { useCurrentOrganization } from "@/web/hooks/use-current-organization";
import { useOrganizationSettings } from "@/web/hooks/use-organization-settings";
import { useDecoChatOpen } from "../hooks/use-deco-chat-open";
import { useChatThreads } from "@deco/ui/providers/chat-threads-provider.tsx";
import { useLocalStorage } from "@/web/hooks/use-local-storage";
import { DecoChatAside } from "@deco/ui/components/deco-chat-aside.tsx";
import { DecoChatMessages } from "@deco/ui/components/deco-chat-messages.tsx";
import { DecoChatMessage } from "@deco/ui/components/deco-chat-message.tsx";
import { DecoChatInputV2 } from "@deco/ui/components/deco-chat-input-v2.tsx";
import { DecoChatModelSelectorRich } from "@deco/ui/components/deco-chat-model-selector-rich.tsx";
import { DecoChatEmptyState } from "@deco/ui/components/deco-chat-empty-state.tsx";
import { DecoChatSkeleton } from "@deco/ui/components/deco-chat-skeleton.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import {
  ModelsBindingProvider,
  type ModelInfo,
} from "@deco/ui/providers/models-binding-provider.tsx";

interface ModelsResponse {
  models: ModelInfo[];
}

// Capybara avatar URL from decopilotAgent
const CAPYBARA_AVATAR_URL =
  "https://assets.decocache.com/decocms/fd07a578-6b1c-40f1-bc05-88a3b981695d/f7fc4ffa81aec04e37ae670c3cd4936643a7b269.png";

function DecoChatPanelInner() {
  const { locator } = useProjectContext();
  const { organization } = useCurrentOrganization();
  const orgSlug = organization?.slug || "";
  const { setOpen } = useDecoChatOpen();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Use thread management from ChatThreadsProvider
  const { messages, addMessage, updateMessage, copyThreadTabs } =
    useChatThreads();

  // Convert thread messages to the format expected by DecoChatMessages
  const chatMessages = useMemo(
    () =>
      messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
    [messages],
  );

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
      const response = await fetch(`/api/${orgSlug}/models/list`, {
        credentials: "include",
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          detail || "Failed to fetch models for the configured provider.",
        );
      }

      return (await response.json()) as ModelsResponse;
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

    return modelsQuery.data.models.map((model) => {
      // Extract provider from model id (e.g., "anthropic/claude-3.5-sonnet" → "anthropic")
      const provider = model.id.split("/")[0] || "";
      const logo = model.logo || providerLogos[provider] || null;

      // Filter capabilities to only show known visual ones
      const capabilities =
        model.capabilities?.filter((cap) => knownCapabilities.has(cap)) || [];

      // Convert costs from per-token to per-1M-tokens (multiply by 1,000,000)
      const inputCost = model.inputCost ? model.inputCost * 1_000_000 : null;
      const outputCost = model.outputCost ? model.outputCost * 1_000_000 : null;

      return {
        ...model,
        logo,
        capabilities,
        inputCost,
        outputCost,
      };
    });
  }, [modelsQuery.data]);

  // Persist selected model per organization in localStorage
  const [selectedModelId, setSelectedModelId] = useLocalStorage<
    string | undefined
  >(`mesh:chat:selectedModel:${orgSlug}`, (existing) => existing);

  // Initialize with first model
  useEffect(() => {
    if (models.length > 0 && !selectedModelId) {
      const firstModel = models[0];
      if (firstModel) {
        setSelectedModelId(firstModel.model);
      }
    }
  }, [models, selectedModelId, setSelectedModelId]);

  const isEmpty = chatMessages.length === 0;

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

  const handleSendMessage = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!input.trim() || !selectedModelId || isLoading) {
        return;
      }

      // Add user message to thread
      addMessage({
        role: "user",
        content: input,
      });
      const userInput = input;
      setInput("");
      setIsLoading(true);

      try {
        const response = await fetch(`/api/${orgSlug}/models/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            messages: [
              ...chatMessages.map((msg) => ({
                role: msg.role,
                content: msg.content,
              })),
              { role: "user", content: userInput },
            ],
            model: selectedModelId,
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let assistantMessage = "";

        // Add empty assistant message that we'll update
        const assistantId = addMessage({
          role: "assistant",
          content: "",
        });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();

              try {
                const data = JSON.parse(dataStr);

                // Handle AI SDK SSE format: message.delta with content array
                if (
                  data.type === "message.delta" &&
                  Array.isArray(data.content)
                ) {
                  for (const contentItem of data.content) {
                    if (
                      contentItem.type === "output_text" &&
                      contentItem.text
                    ) {
                      assistantMessage += contentItem.text;
                    }
                  }

                  updateMessage(assistantId, { content: assistantMessage });
                }
              } catch {
                // Ignore parse errors for non-JSON lines
              }
            }
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error("[deco-chat] Send error:", error);
        setIsLoading(false);
        addMessage({
          role: "assistant",
          content: `Error: ${(error as Error).message}`,
        });
      }
    },
    [
      input,
      selectedModelId,
      isLoading,
      orgSlug,
      chatMessages,
      addMessage,
      updateMessage,
      messages,
    ],
  );

  const handleStop = useCallback(() => {
    setIsLoading(false);
  }, []);

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
              {chatMessages.map((message, index) => (
                <DecoChatMessage
                  key={message.id}
                  id={message.id}
                  role={message.role as "user" | "assistant" | "system"}
                  content={message.content}
                  timestamp={message.timestamp}
                  isStreaming={isLoading && index === chatMessages.length - 1}
                />
              ))}
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

// Export the inner panel without the provider wrapper
export function DecoChatPanel() {
  return <DecoChatPanelInner />;
}
