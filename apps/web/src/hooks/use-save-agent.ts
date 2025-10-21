import type { Agent } from "@deco/sdk";
import { DEFAULT_MODEL, WELL_KNOWN_AGENTS, useUpdateAgent } from "@deco/sdk";
import { toast } from "sonner";
import { useCreateAgent } from "./use-create-agent.ts";

export function useSaveAgent() {
  const updateAgentMutation = useUpdateAgent();
  const createAgent = useCreateAgent();

  const saveAgent = async (agent: Agent) => {
    // Check if this is a well-known agent being saved for the first time
    const isWellKnownAgent = Boolean(
      WELL_KNOWN_AGENTS[agent.id as keyof typeof WELL_KNOWN_AGENTS],
    );

    if (isWellKnownAgent) {
      // Generate a new UUID and create a new agent instead of updating
      const id = crypto.randomUUID();
      const newAgent = {
        ...agent,
        id,
        model: agent.model ?? DEFAULT_MODEL.id,
      };
      await createAgent(newAgent, {
        eventName: "agent_create_from_well_known",
      });
      toast.success("Agent created successfully");
      return;
    }

    // Normal update flow for custom agents
    await updateAgentMutation.mutateAsync(agent);
    toast.success("Agent updated successfully");
  };

  return saveAgent;
}
