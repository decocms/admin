import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MCPConnection } from "@/storage/types";
import { fetcher } from "@/tools/client";
import { KEYS } from "@/web/lib/query-keys";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { useCurrentOrganization } from "@/web/hooks/use-current-organization";
import { useOrganizationSettings } from "@/web/hooks/use-organization-settings";
import { useDecoChatOpen } from "../hooks/use-deco-chat-open";
import { useLocalStorage } from "@/web/hooks/use-local-storage";
import { DecoChatAside } from "@deco/ui/components/deco-chat-aside.tsx";
import { DecoChatHeader } from "@deco/ui/components/deco-chat-header.tsx";
import { DecoChatMessages } from "@deco/ui/components/deco-chat-messages.tsx";
import { DecoChatMessage } from "@deco/ui/components/deco-chat-message.tsx";
import { DecoChatInputV2 } from "@deco/ui/components/deco-chat-input-v2.tsx";
import { DecoChatModelSelectorRich } from "@deco/ui/components/deco-chat-model-selector-rich.tsx";
import { DecoChatEmptyState } from "@deco/ui/components/deco-chat-empty-state.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import {
  ModelsBindingProvider,
  type ModelInfo,
} from "@deco/ui/providers/models-binding-provider.tsx";

interface ModelsResponse {
  models: ModelInfo[];
}

export function DecoChatPanel() {
  const { locator } = useProjectContext();
  const { organization } = useCurrentOrganization();
  const orgSlug = organization?.slug || "";
  const { setOpen } = useDecoChatOpen();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: string; content: string; id: string; timestamp: string }>
  >([]);

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

  const clearConversation = useCallback(() => {
    setInput("");
    setChatMessages([]);
  }, []);

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

      const userMessage = {
        role: "user",
        content: input,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, userMessage]);
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
            messages: [...chatMessages, userMessage].map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
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
        const assistantId = crypto.randomUUID();

        // Add empty assistant message that we'll update
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "",
            id: assistantId,
            timestamp: new Date().toISOString(),
          },
        ]);

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

                  setChatMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, content: assistantMessage }
                        : msg,
                    ),
                  );
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
      }
    },
    [input, selectedModelId, isLoading, orgSlug, chatMessages],
  );

  const handleStop = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <ModelsBindingProvider value={modelsBindingValue}>
      <DecoChatAside className="h-full">
        <DecoChatAside.Header>
          <DecoChatHeader
            avatar="/img/logo-tiny.svg"
            name="deco chat"
            subtitle={connection ? `Powered by ${connection.name}` : undefined}
            actions={
              !isEmpty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearConversation}
                  className="size-6 rounded-full"
                  title="Clear conversation"
                >
                  <Icon name="refresh" size={16} />
                </Button>
              )
            }
            onClose={() => setOpen(false)}
          />
        </DecoChatAside.Header>

        <DecoChatAside.Content>
          {modelsQuery.isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground p-4 text-xs">
              <span className="size-2 animate-pulse rounded-full bg-muted-foreground" />
              Loading models...
            </div>
          )}

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
