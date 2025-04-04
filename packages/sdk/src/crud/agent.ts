import { type Agent, AgentSchema } from "../models/agent.ts";
import { SDK } from "../index.ts";
import { WELL_KNOWN_INITIAL_TOOLS_SET } from "../constants.ts";

export const HOME_PATH = "~/Agents";
export const MANIFEST_PATH = ".webdraw/manifest.json";

/**
 * Convert an agent to a locator
 *
 * @param agent - The agent to convert
 * @returns The locator
 */
export const toLocator = (agentId: string) => {
  return `${HOME_PATH}/${agentId}/${MANIFEST_PATH}`;
};

export const toAgentRoot = (agentId: string) => {
  return `${HOME_PATH}/${agentId}`;
};

/**
 * Save an agent to the file system
 * @param agent - The agent to save
 */
export const saveAgent = async (agent: Agent) => {
  const path = toLocator(agent.id);
  const content = JSON.stringify(agent);

  await SDK.fs.write(path, content);
};

/**
 * Create a new agent
 * @returns The new agent
 */
export const createAgent = async (
  template: Partial<Agent> = {},
) => {
  const agent: Agent = {
    id: crypto.randomUUID(),
    name: "Anonymous",
    instructions: "This agent has not been configured yet.",
    avatar: "", // You could add a default avatar path here if needed
    description: "A customizable AI assistant", // Default description
    tools_set: {
      CORE: template.id === "teamAgent"
        ? [...WELL_KNOWN_INITIAL_TOOLS_SET.CORE, "AGENT_CREATE"]
        : WELL_KNOWN_INITIAL_TOOLS_SET.CORE,
    },
    model: "anthropic:claude-3-7-sonnet-20250219", // Default model
    views: [{ url: "", name: "Chat" }],
    ...template,
  };

  await saveAgent(agent);

  return agent;
};

/**
 * Load an agent from the file system
 * @param agentId - The id of the agent to load
 * @returns The agent
 */
export const loadAgent = async (agentId: string) => {
  const path = toLocator(agentId);
  const content = await SDK.fs.read(path);

  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
};

/**
 * Delete an agent from the file system
 * @param agentId - The id of the agent to delete
 */
export const deleteAgent = async (agentId: string) => {
  const path = toLocator(agentId);
  await SDK.fs.unlink(path);
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
