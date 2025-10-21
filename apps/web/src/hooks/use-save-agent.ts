import type { Agent } from "@deco/sdk";
import {
  DEFAULT_MODEL,
  useCreateAgent,
  useUpdateAgent,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import { useCallback } from "react";
import { toast } from "sonner";

export function useSaveAgent() {
  const updateAgentMutation = useUpdateAgent();
  const createAgentMutation = useCreateAgent();

  const handleSaveAgent = useCallback(
    async (agent: Agent) => {
      const isWellKnownAgent = Boolean(
        WELL_KNOWN_AGENTS[agent.id as keyof typeof WELL_KNOWN_AGENTS],
      );

      if (isWellKnownAgent) {
        const id = crypto.randomUUID();
        const newAgent = {
          ...agent,
          id, // Overwrite the fixed ID with a new UUID
          model: agent.model ?? DEFAULT_MODEL.id, // Ensure model is present
        };
        await createAgentMutation.mutateAsync(newAgent);
        toast.success("Agent created successfully");
        return;
      }

      await updateAgentMutation.mutateAsync(agent);
      toast.success("Agent updated successfully");
    },
    [updateAgentMutation],
  );

  return handleSaveAgent;
}
