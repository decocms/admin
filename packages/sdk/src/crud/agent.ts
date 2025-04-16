import {
  API_HEADERS,
  API_SERVER_URL,
  DEFAULT_REASONING_MODEL,
} from "../constants.ts";
import { type Agent, AgentSchema } from "../models/agent.ts";
import { stub } from "../stub.ts";

const toPath = (segments: string[]) => segments.join("/");

const fetchAPI = (segments: string[], init?: RequestInit) =>
  fetch(new URL(toPath(segments), API_SERVER_URL), {
    ...init,
    credentials: "include",
    headers: { ...API_HEADERS, ...init?.headers },
  });

export class AgentNotFoundError extends Error {
  agentId: string;

  constructor(agentId: string) {
    super(`Agent ${agentId} not found`);
    this.agentId = agentId;
  }
}

/**
 * Update an agent
 * @param context - The context of the agent
 * @param agent - The agent to update
 * @returns The updated agent
 */
export const updateAgent = async (context: string, agent: Agent) => {
  const agentRoot = `/${context}/Agents/${agent.id}`;

  // deno-lint-ignore no-explicit-any
  const agentStub = stub<any>("AIAgent")
    .new(agentRoot);

  await agentStub.configure(agent);

  return agent;
};

/**
 * Create a new agent
 * @returns The new agent
 */
export const createAgent = async (
  context: string,
  template: Partial<Agent> = {},
) => {
  const agent: Partial<Agent> = {
    id: crypto.randomUUID(),
    ...template,
  };

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
 * Load an agent from the file system
 * @param agentId - The id of the agent to load
 * @returns The agent
 */
export const loadAgent = async (context: string, agentId: string) => {
  const response = await fetchAPI([context, "agent", agentId]);

  if (response.ok) {
    return response.json() as Promise<Agent>;
  }

  if (response.status === 404) {
    throw new AgentNotFoundError(agentId);
  }

  throw new Error("Failed to load agent");
};

export const listAgents = async (context: string) => {
  const response = await fetchAPI([context, "agents"]);

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
