import {
  NotFoundError,
  WELL_KNOWN_AGENT_IDS,
  WELL_KNOWN_DECOPILOT_AGENTS,
  isWellKnownDecopilotAgent,
  type AgentId,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense, useMemo } from "react";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { useFocusChat } from "../agents/hooks.ts";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { useAgenticChat } from "../chat/provider.tsx";
import { useAgentStore } from "../../stores/mode-store.ts";

// Extract short description from agent goals
const AGENT_DESCRIPTIONS: Record<AgentId, string> = {
  design: "Design documents for implementation planning",
  code: "Creates and modifies tools, workflows and views",
  explore: "Explore the system and it's capabilities",
  decopilot: "General purpose assistant for the platform",
};

export function EmptyState() {
  const {
    metadata: { agentId },
  } = useAgenticChat();

  if (agentId === WELL_KNOWN_AGENT_IDS.teamAgent) {
    return (
      <div className="py-10">
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="text-2xl font-medium leading-loose text-foreground">
            What can I help with?
          </div>
          <div className="text-sm font-normal text-muted-foreground max-w-[510px] text-center">
            Use this chat to ask questions, generate content, execute tasks or
            <br />
            <span className="italic font-mono text-base">
              build personalized agents.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={<EmptyState.Fallback />}
      shouldCatch={(e) => e instanceof NotFoundError}
    >
      <Suspense fallback={<EmptyState.Skeleton />}>
        <EmptyState.UI />
      </Suspense>
    </ErrorBoundary>
  );
}

EmptyState.Fallback = () => {
  return null;
};

EmptyState.Skeleton = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center animate-pulse gap-4 py-10">
      <div className="bg-muted w-2/3 rounded-xl h-10 ml-auto" />
      <div className="bg-muted w-2/3 rounded-xl h-10 mr-auto" />
      <div className="bg-muted w-2/3 rounded-xl h-10 ml-auto" />
    </div>
  );
};

EmptyState.UI = () => {
  const {
    metadata: { agentId: metadataAgentId },
    agent,
    uiOptions,
  } = useAgenticChat();
  const editAgent = useFocusChat();

  // Get current agent ID from store (updates reactively when agent changes)
  const { agentId: currentAgentId } = useAgentStore();

  // Use currentAgentId from store if it's a well-known agent, otherwise fall back to metadataAgentId
  const effectiveAgentId = isWellKnownDecopilotAgent(currentAgentId)
    ? currentAgentId
    : metadataAgentId;

  // Get current agent info (updates immediately when agent changes)
  const currentAgent = useMemo(() => {
    const isDecopilot = isWellKnownDecopilotAgent(effectiveAgentId);
    if (isDecopilot) {
      return WELL_KNOWN_DECOPILOT_AGENTS[effectiveAgentId as AgentId];
    }
    return null;
  }, [effectiveAgentId]);

  // Use current agent from store for display (for reactive updates)
  const displayName =
    currentAgent?.name || agent?.name || "Tell me who I am and how I should be";
  const displayDescription = currentAgent
    ? AGENT_DESCRIPTIONS[effectiveAgentId as AgentId]
    : agent?.description || "The more you share, the better I get.";

  // Use agent avatar from current agent or context
  const agentAvatarUrl = currentAgent?.avatar || agent?.avatar;
  const agentAvatarName = currentAgent?.name || agent?.name;

  return (
    <div className="h-full flex flex-col justify-between py-12">
      <div className="flex flex-col items-center justify-center max-w-2xl mx-auto p-4 duration-300 transition-all">
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="w-12 h-12 flex items-center justify-center">
            {agentAvatarUrl ? (
              <img
                src={agentAvatarUrl}
                alt={agentAvatarName}
                className="w-12 h-12 rounded-lg object-cover border border-border"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = "none";
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = "flex";
                  }
                }}
              />
            ) : (
              <AgentAvatar
                url={agent?.avatar}
                fallback={agent?.name}
                size="lg"
              />
            )}
            <div
              className="w-12 h-12 rounded-lg bg-muted border border-border items-center justify-center hidden"
              style={{ display: "none" }}
            >
              <Icon
                name="smart_toy"
                size={24}
                className="text-muted-foreground"
              />
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-medium text-foreground">
                {displayName}
              </h2>
            </div>
            <p className="text-muted-foreground mx-6 text-center">
              {displayDescription}
            </p>
            {uiOptions.showEditAgent && (
              <Button
                variant="outline"
                onClick={() => editAgent(effectiveAgentId, crypto.randomUUID())}
              >
                <Icon name="tune" size={16} />
                Edit agent
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
