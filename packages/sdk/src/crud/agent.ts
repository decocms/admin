import { ForbiddenError, NotFoundError, UnauthorizedError } from "../errors.ts";
import { MCPClient } from "../fetcher.ts";
import { type Agent, AgentSchema } from "../models/agent.ts";
import { stub } from "../stub.ts";

export class AgentNotFoundError extends NotFoundError {
  agentId: string;

  constructor(agentId: string) {
    super(`Agent ${agentId} not found`);
    this.agentId = agentId;
  }
}

/**
 * Update an agent
 * @param workspace - The workspace of the agent
 * @param agent - The agent to update
 * @returns The updated agent
 */
export const updateAgent = async (workspace: string, agent: Agent) => {
  const agentRoot = `/${workspace}/Agents/${agent.id}`;

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
  workspace: string,
  template: Partial<Agent> = {},
) => {
  const { error, data } = await MCPClient.forWorkspace(workspace).AGENTS_CREATE(
    {
      id: crypto.randomUUID(),
      ...template,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const createTempAgent = async (
  workspace: string,
  agentId: string,
  userId: string,
) => {
  const { error, data } = await MCPClient.forWorkspace(workspace)
    .AGENTS_CREATE_TEMP({ agentId, userId });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

/**
 * Load an agent from the file system
 * @param agentId - The id of the agent to load
 * @returns The agent
 */
export const loadAgent = async (
  workspace: string,
  agentId: string,
  signal?: AbortSignal,
): Promise<Agent> => {
  const { error, data, status } = await MCPClient.forWorkspace(workspace)
    .AGENTS_GET(
      { id: agentId },
      { signal },
    );

  if (status === 404) {
    throw new AgentNotFoundError(agentId);
  }

  if (status === 401) {
    throw new UnauthorizedError();
  }

  if (status === 403) {
    throw new ForbiddenError();
  }

  if (error) {
    throw new Error(error.message || "Failed to load agent");
  }

  return data;
};

export const listAgents = async (
  workspace: string,
  signal?: AbortSignal,
): Promise<Agent[]> => {
  const { error, data } = await MCPClient.forWorkspace(workspace).AGENTS_LIST(
    {},
    { signal },
  );

  if (error) {
    throw new Error(error.message || "Failed to list agents");
  }

  return data;
};

/**
 * Delete an agent from the file system
 * @param workspace - The workspace of the agent
 * @param agentId - The id of the agent to delete
 */
export const deleteAgent = async (workspace: string, agentId: string) => {
  const { error, data } = await MCPClient.forWorkspace(workspace).AGENTS_DELETE(
    { id: agentId },
  );

  if (error) {
    throw new Error(error.message || "Failed to delete agent");
  }

  return data;
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

export const getTempAgent = async (
  workspace: string,
  userId: string,
) => {
  const { error, data } = await MCPClient.forWorkspace(workspace)
    .AGENTS_GET_TEMP({ userId });
  if (error) {
    throw new Error(error.message);
  }
  return data;
};
