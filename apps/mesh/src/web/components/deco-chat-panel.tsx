import { EmptyState } from "@/web/components/empty-state";
import { useAgentsFromConnection } from "@/web/hooks/collections/use-agent";
import { useConnections } from "@/web/hooks/collections/use-connection";
import { useLLMsFromConnection } from "@/web/hooks/collections/use-llm";
import { useBindingConnections } from "@/web/hooks/use-binding";
import { useDecoChatOpen } from "@/web/hooks/use-deco-chat-open";
import { authClient } from "@/web/lib/auth-client";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { Button } from "@deco/ui/components/button.tsx";
import { DecoChatAgentSelector } from "@deco/ui/components/deco-chat-agent-selector.tsx";
import { DecoChatAside } from "@deco/ui/components/deco-chat-aside.tsx";
import { DecoChatEmptyState } from "@deco/ui/components/deco-chat-empty-state.tsx";
import { DecoChatInputV2 } from "@deco/ui/components/deco-chat-input-v2.tsx";
import {
  DecoChatMessageAssistant,
  DecoChatMessageFooter,
  DecoChatMessageUser,
} from "@deco/ui/components/deco-chat-message.tsx";
import { DecoChatMessages } from "@deco/ui/components/deco-chat-messages.tsx";
import { DecoChatModelSelectorRich } from "@deco/ui/components/deco-chat-model-selector-rich.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Metadata } from "@deco/ui/types/chat-metadata.ts";
import { useNavigate } from "@tanstack/react-router";
import { type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useChat } from "../providers/chat-provider";

// Capybara avatar URL from decopilotAgent
const CAPYBARA_AVATAR_URL =
  "https://assets.decocache.com/decocms/fd07a578-6b1c-40f1-bc05-88a3b981695d/f7fc4ffa81aec04e37ae670c3cd4936643a7b269.png";

export function DecoChatPanel() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const { org } = useProjectContext();
  const [, setOpen] = useDecoChatOpen();
  const navigate = useNavigate();

  // Use chat management from ChatProvider
  const {
    createThread,
    chat,
    sentinelRef,
    activeThreadId,
    selectedModelState,
    setSelectedModelState,
    selectedAgentState,
    setSelectedAgentState,
  } = useChat();

  const { status } = chat;

  // Local state for input
  const [input, setInput] = useState("");

  // Get all connections
  const allConnections = useConnections() ?? [];

  // Filter connections by binding type
  const [modelsConnection] = useBindingConnections(allConnections, "LLMS");
  const [agentsConnection] = useBindingConnections(allConnections, "AGENTS");

  // Fetch models from the first LLM connection
  const modelsData = useLLMsFromConnection(modelsConnection?.id) ?? [];

  // Fetch agents from the first AGENTS connection
  const agentsData = useAgentsFromConnection(agentsConnection?.id) ?? [];

  // Transform models for UI display
  const models = useMemo(() => {
    if (!modelsData || !modelsConnection) return [];

    return modelsData
      .map((model) => ({
        ...model,
        name: model.title,
        contextWindow: model.limits?.contextWindow,
        outputLimit: model.limits?.maxOutputTokens,
        inputCost: model.costs?.input,
        outputCost: model.costs?.output,
        provider: model.provider,
        connectionId: modelsConnection.id,
        connectionName: modelsConnection.title,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
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

  // Initialize with first model
  // oxlint-disable-next-line ban-use-effect/ban-use-effect
  useEffect(() => {
    if (models.length > 0 && !selectedModelState) {
      const firstModel = models[0];
      if (firstModel) {
        setSelectedModelState({
          id: firstModel.id,
          connectionId: firstModel.connectionId,
        });
      }
    }
  }, [models, selectedModelState, setSelectedModelState]);

  // Initialize with first agent
  // oxlint-disable-next-line ban-use-effect/ban-use-effect
  useEffect(() => {
    if (agents.length > 0 && !selectedAgentState) {
      const firstAgent = agents[0];
      if (firstAgent) {
        setSelectedAgentState({
          agentId: firstAgent.id,
          connectionId: firstAgent.connectionId,
        });
      }
    }
  }, [agents, selectedAgentState, setSelectedAgentState]);

  // Get selected model info
  const selectedModel = useMemo(
    () =>
      models.find(
        (m) =>
          m.id === selectedModelState?.id &&
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

  const isEmpty = chat.messages.length === 0;

  // Auto-scroll to bottom when messages change
  // oxlint-disable-next-line ban-use-effect/ban-use-effect
  useEffect(() => {
    if (sentinelRef.current && chat.messages.length > 0) {
      sentinelRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [chat.messages, sentinelRef]);

  // Transform agents to selector options
  const agentSelectorOptions = useMemo(() => {
    return agents.map((agent) => ({
      id: `${agent.connectionId}:${agent.id}`,
      name: agent.title,
      avatar: agent.avatar,
      description: agent.description,
    }));
  }, [agents]);

  // Wrapped send message - enriches request with metadata (similar to provider.tsx)
  const wrappedSendMessage = useCallback(
    async (message: UIMessage<Metadata>) => {
      if (!selectedModelState || !selectedModel) {
        // Console error kept for critical missing configuration
        console.error("No model configured");
        return;
      }

      // Prepare metadata with model and agent configuration
      const metadata: Metadata = {
        model: selectedModelState ?? undefined,
        agent: selectedAgent ?? undefined,
        user: {
          avatar: user?.image ?? undefined,
          name: user?.name ?? "you",
        },
        created_at: new Date().toISOString(),
        thread_id: activeThreadId,
      };

      // Set user message's thread_id
      message.metadata = {
        ...metadata,
        thread_id: activeThreadId,
      };

      return await chat.sendMessage(message, { metadata });
    },
    [
      chat,
      selectedModelState,
      selectedModel,
      selectedAgent,
      user,
      activeThreadId,
    ],
  );

  const handleSendMessage = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!input?.trim() || status === "submitted" || status === "streaming") {
        return;
      }

      // Create and send message with metadata
      const userMessage: UIMessage<Metadata> = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: input }],
      };

      setInput("");
      // Use the wrapped send message function
      await wrappedSendMessage(userMessage);
    },
    [input, status, wrappedSendMessage],
  );

  const handleStop = useCallback(() => {
    chat.stop?.();
  }, [chat]);

  // Check if both required bindings are present
  const hasModelsBinding = !!modelsConnection;
  const hasAgentsBinding = !!agentsConnection;
  const hasBothBindings = hasModelsBinding && hasAgentsBinding;

  // If missing bindings, show empty state with appropriate message
  if (!hasBothBindings) {
    let title: string;
    let description: string;

    if (!hasModelsBinding && !hasAgentsBinding) {
      title = "Connect your providers";
      description =
        "Add MCPs with llm and agents to unlock AI-powered features.";
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
                createThread();
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
          <DecoChatMessages minHeightOffset={264}>
            {chat.messages.map((message, index) =>
              message.role === "user" ? (
                <DecoChatMessageUser
                  key={message.id}
                  message={message as UIMessage<Metadata>}
                />
              ) : message.role === "assistant" ? (
                <DecoChatMessageAssistant
                  key={message.id}
                  message={message as UIMessage<Metadata>}
                  status={
                    index === chat.messages.length - 1 ? status : undefined
                  }
                />
              ) : null,
            )}
            <DecoChatMessageFooter>
              <div ref={sentinelRef} className="h-0" />
            </DecoChatMessageFooter>
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
          isStreaming={status === "submitted" || status === "streaming"}
          placeholder={
            models.length === 0
              ? "Add an LLM binding connection to start chatting"
              : "Ask anything or @ for context"
          }
          leftActions={
            <div className="flex items-center gap-2">
              {/* Agent Selector - Rich style */}
              {agents.length > 0 && (
                <DecoChatAgentSelector
                  agents={agentSelectorOptions}
                  selectedAgentId={
                    selectedAgentState
                      ? `${selectedAgentState.connectionId}:${selectedAgentState.agentId}`
                      : undefined
                  }
                  onAgentChange={(value) => {
                    if (!value) return;
                    const [connectionId, agentId] = value.split(":");
                    if (connectionId && agentId) {
                      setSelectedAgentState({ agentId, connectionId });
                    }
                  }}
                  placeholder="Agent"
                  variant="bordered"
                />
              )}
              {/* Model Selector - Rich style */}
              {models.length > 0 && (
                <DecoChatModelSelectorRich
                  models={models}
                  selectedModelId={selectedModelState?.id}
                  onModelChange={(modelId) => {
                    if (!modelId) return;
                    const model = models.find((m) => m.id === modelId);
                    if (model) {
                      setSelectedModelState({
                        id: model.id,
                        connectionId: model.connectionId,
                      });
                    }
                  }}
                  placeholder="Model"
                  variant="borderless"
                />
              )}
            </div>
          }
        />
      </DecoChatAside.Footer>
    </DecoChatAside>
  );
}
