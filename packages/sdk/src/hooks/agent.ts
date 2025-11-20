/**
 * Agent specific hooks
 */

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_MODEL } from "../constants.ts";
import {
  createAgent,
  deleteAgent,
  listAgents,
  loadAgent,
  updateAgent,
} from "../crud/agent.ts";
import { InternalServerError } from "../errors.ts";
import type { Agent } from "../models/agent.ts";
import {
  isWellKnownDecopilotAgent,
  WELL_KNOWN_DECOPILOT_AGENTS,
} from "../types/well-known-agents.ts";
import { KEYS } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";

export const useCreateAgent = () => {
  const client = useQueryClient();
  const { locator } = useSDK();

  const create = useMutation({
    mutationFn: (agent: Partial<Agent>) => createAgent(locator, agent),
    onSuccess: (result) => {
      // Ensure model is always defined
      const agentWithModel: Agent = {
        ...result,
        model: result.model ?? DEFAULT_MODEL.id,
      };

      // update item
      const itemKey = KEYS.AGENT(locator, agentWithModel.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Agent>(itemKey, agentWithModel);

      // update list
      const listKey = KEYS.AGENT(locator);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Agent[]>(listKey, (old) =>
        !old ? [agentWithModel] : [agentWithModel, ...old],
      );
    },
  });

  return create;
};

export const useUpdateAgent = () => {
  const client = useQueryClient();
  const { locator } = useSDK();

  const update = useMutation({
    mutationFn: (agent: Agent) => updateAgent(locator, agent),
    onSuccess: (result) => {
      // update item
      const itemKey = KEYS.AGENT(locator, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Agent>(itemKey, result);

      // update list
      const listKey = KEYS.AGENT(locator);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Agent[]>(listKey, (old) =>
        !old ? [result] : old.map((a) => (a.id === result.id ? result : a)),
      );
    },
  });

  return update;
};

export const useRemoveAgent = () => {
  const client = useQueryClient();
  const { locator } = useSDK();

  const remove = useMutation({
    mutationFn: (id: string) => deleteAgent(locator, id),
    onSuccess: (_, id) => {
      // Remove the individual agent from cache
      const itemKey = KEYS.AGENT(locator, id);
      client.cancelQueries({ queryKey: itemKey });
      client.removeQueries({ queryKey: itemKey });

      // Update the list
      const listKey = KEYS.AGENT(locator);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Agent[]>(listKey, (old) =>
        !old ? [] : old.filter((agent) => agent.id !== id),
      );

      // Invalidate triggers
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(locator) });
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(locator, id) });
    },
  });

  return remove;
};

/** Hook for fetching agent data from server */
export const useAgentData = (id: string) => {
  const { locator } = useSDK();

  // For well-known decopilot agents, construct the agent object locally
  // instead of fetching from the backend
  const isWellKnown = isWellKnownDecopilotAgent(id);
  const wellKnownAgentData = useMemo<Agent | null>(() => {
    if (!isWellKnown) return null;

    // Handle legacy "decopilotAgent" by mapping to "explore"
    const effectiveAgentId = id === "decopilotAgent" ? "explore" : id;
    const wellKnownAgent =
      WELL_KNOWN_DECOPILOT_AGENTS[
        effectiveAgentId as keyof typeof WELL_KNOWN_DECOPILOT_AGENTS
      ];
    if (!wellKnownAgent) return null;

    return {
      id: wellKnownAgent.id,
      name: wellKnownAgent.name,
      avatar: wellKnownAgent.avatar,
      description: "Ask, search or create anything.",
      model: DEFAULT_MODEL.id,
      visibility: "PUBLIC" as const,
      tools_set: {}, // Tools are filtered server-side based on agentId
      views: [],
      instructions: "",
      max_steps: 30, // Same as old decopilotAgent
      max_tokens: 64000, // Same as old decopilotAgent
      memory: { last_messages: 8 }, // Same as old decopilotAgent
    };
  }, [id, isWellKnown]);

  const data = useSuspenseQuery({
    queryKey: KEYS.AGENT(locator, id),
    queryFn: ({ signal }) => {
      // Return well-known agent data immediately without network call
      if (wellKnownAgentData) {
        return Promise.resolve(wellKnownAgentData);
      }
      return loadAgent(locator, id, signal);
    },
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    staleTime: isWellKnown ? Infinity : 5 * 60 * 1000, // Never stale for well-known agents
    gcTime: isWellKnown ? Infinity : 10 * 60 * 1000, // Never garbage collect well-known agents
  });

  return data;
};

/** Hook for listing all agents */
export const useAgents = () => {
  const { locator } = useSDK();
  const client = useQueryClient();

  const data = useSuspenseQuery({
    queryKey: KEYS.AGENT(locator),
    queryFn: async ({ signal }) => {
      const items = await listAgents(locator, signal);

      for (const item of items) {
        const itemKey = KEYS.AGENT(locator, item.id);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData(itemKey, item);
      }

      return items;
    },
  });

  return data;
};

export const useAgentRoot = (agentId: string) => {
  const { locator } = useSDK();

  const root = useMemo(
    () => `/${locator}/Agents/${agentId}`,
    [locator, agentId],
  );

  return root;
};
