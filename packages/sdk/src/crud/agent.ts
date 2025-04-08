import {
  API_HEADERS,
  API_SERVER_URL,
  WELL_KNOWN_AGENT_IDS,
  WELL_KNOWN_INITIAL_TOOLS_SET,
} from "../constants.ts";
import { type Agent, AgentSchema } from "../models/agent.ts";

const toPath = (segments: string[]) => segments.join("/");

const fetchAPI = (segments: string[], init?: RequestInit) =>
  fetch(new URL(toPath(segments), API_SERVER_URL), {
    ...init,
    headers: { ...API_HEADERS, ...init?.headers },
  });

/**
 * Save an agent to the file system
 * @param agent - The agent to save
 */
export const saveAgent = async (context: string, agent: Agent) => {
  const response = await fetchAPI([context, "agent"], {
    method: "POST",
    body: JSON.stringify(agent),
  });

  if (response.ok) {
    return response.json() as Promise<Agent>;
  }

  throw new Error("Failed to save agent");
};

/**
 * Create a new agent
 * @returns The new agent
 */
export const createAgent = async (
  context: string,
  template: Partial<Agent> = {},
) => {
  const agent: Agent = {
    id: crypto.randomUUID(),
    name: "Anonymous",
    instructions: "This agent has not been configured yet.",
    avatar: "", // You could add a default avatar path here if needed
    description: "A customizable AI assistant", // Default description
    tools_set: {
      CORE: template.id === WELL_KNOWN_AGENT_IDS.teamAgent
        ? [...WELL_KNOWN_INITIAL_TOOLS_SET.CORE, "AGENT_CREATE"]
        : WELL_KNOWN_INITIAL_TOOLS_SET.CORE,
    },
    model: "anthropic:claude-3-7-sonnet-20250219", // Default model
    views: [{ url: "", name: "Chat" }],
    ...template,
  };

  await saveAgent(context, agent);

  return agent;
};

/**
 * Load an agent from the file system
 * @param agentId - The id of the agent to load
 * @returns The agent
 */
export const loadAgent = async (context: string, agentId: string) => {
  const response = await fetchAPI([context, "agent", agentId]);

  if (response.ok) {
    return response.json() as Promise<Agent>;
  }

  throw new Error("Failed to load agent");
};

export const listAgents = async (context: string) => {
  const response = await fetchAPI([context, "agent"]);

  if (response.ok) {
    return response.json() as Promise<{ items: Agent[] }>;
  }

  throw new Error("Failed to list agents");
};

/**
 * Delete an agent from the file system
 * @param agentId - The id of the agent to delete
 */
export const deleteAgent = async (context: string, agentId: string) => {
  const response = await fetchAPI([context, "agent", agentId], {
    method: "DELETE",
  });

  if (response.ok) {
    return response.json();
  }

  throw new Error("Failed to delete agent");
};

/**
 * Validate an agent against the Zod schema
 *
 * @param agent - The agent to validate
 * @returns The validated agent or an error
 */
export const validateAgent = (
  agent: unknown,
): [Agent, null] | [null, Error] => {
  try {
    const validatedAgent = AgentSchema.parse(agent);
    return [validatedAgent, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error("Invalid agent")];
  }
};
