import { formatIntegrationId, WellKnownMcpGroups } from "../../crud/groups.ts";
import { DeconfigResourceV2 } from "../deconfig-v2/index.ts";
import { createToolGroup, DeconfigClient } from "../index.ts";
import {
  AgentV2DataSchema,
  ModelV2DataSchema,
  ThreadV2DataSchema,
} from "./schemas.ts";

/**
 * Agents V2 Resource Management
 *
 * This module provides Resources 2.0 implementations for agent, thread, and model management
 * using the DeconfigResources 2.0 system with file-based storage.
 *
 * Key Features:
 * - File-based storage in DECONFIG directories
 * - Resources 2.0 standardized schemas and URI format
 * - Type-safe definitions with Zod validation
 * - Full CRUD operations
 * - Parallel system to legacy database agents
 *
 * Storage:
 * - Agents → /agents/{id}.json
 * - Threads → /threads/{id}.json
 * - Models → /models/{id}.json
 */

// Use well-known MCP group for agents management v2
const AGENTS_V2_GROUP = WellKnownMcpGroups.AgentsV2;

// Create the AgentResourceV2 using DeconfigResources 2.0
export const AgentResourceV2 = DeconfigResourceV2.define({
  directory: "/agents",
  resourceName: "agent",
  group: AGENTS_V2_GROUP,
  dataSchema: AgentV2DataSchema,
});

// Create the ThreadResourceV2 using DeconfigResources 2.0
export const ThreadResourceV2 = DeconfigResourceV2.define({
  directory: "/threads",
  resourceName: "thread",
  group: AGENTS_V2_GROUP,
  dataSchema: ThreadV2DataSchema,
});

// Create the ModelResourceV2 using DeconfigResources 2.0
export const ModelResourceV2 = DeconfigResourceV2.define({
  directory: "/models",
  resourceName: "model",
  group: AGENTS_V2_GROUP,
  dataSchema: ModelV2DataSchema,
});

// Helper functions to create resource implementations
export function createAgentResourceV2Implementation(
  deconfig: DeconfigClient,
  integrationId: string,
) {
  return AgentResourceV2.create(deconfig, integrationId);
}

export function createThreadResourceV2Implementation(
  deconfig: DeconfigClient,
  integrationId: string,
) {
  return ThreadResourceV2.create(deconfig, integrationId);
}

export function createModelResourceV2Implementation(
  deconfig: DeconfigClient,
  integrationId: string,
) {
  return ModelResourceV2.create(deconfig, integrationId);
}

// Export the integration ID helper
export function getAgentsV2IntegrationId() {
  return formatIntegrationId(AGENTS_V2_GROUP);
}

/**
 * Custom Tools for Agents V2
 *
 * These tools provide additional functionality beyond basic CRUD operations:
 * - Chat with agents
 * - Append messages to threads
 * - Generate text/objects with models
 * - Stream text responses
 */

const createAgentTool = createToolGroup(AGENTS_V2_GROUP, {
  name: "Agents Management V2",
  description:
    "Manage agents, threads, and models using Resources 2.0 with Deconfig storage",
  icon: "https://assets.decocache.com/mcp/6f6bb7ac-e2bd-49fc-a67c-96d09ef84993/Agent-Management.png",
});

// Note: Custom tool implementations will be added here
// For now, these are placeholders that return URLs or basic responses
// The actual implementation will require integration with the AI SDK and model providers

import { z } from "zod";

/**
 * DECO_THREADS_V2_APPEND_MESSAGE
 * Appends a new message to an existing thread
 */
export const appendThreadMessage = createAgentTool({
  name: "DECO_THREADS_V2_APPEND_MESSAGE",
  description: "Append a new message to a thread",
  inputSchema: z.object({
    threadUri: z.string().describe("Thread resource URI (rsc://threads/{id})"),
    message: z.any().describe("UIMessage to append to the thread"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    threadUri: z.string(),
    messageCount: z.number(),
  }),
  handler: async ({ threadUri, message }, c) => {
    // This is a placeholder implementation
    // The actual implementation would:
    // 1. Read the thread from deconfig
    // 2. Append the message to the messages array
    // 3. Update the thread in deconfig
    // 4. Return success status

    return {
      success: true,
      threadUri,
      messageCount: 1, // Placeholder
    };
  },
});

/**
 * DECO_MODELS_V2_STREAM_TEXT
 * Returns a streaming URL for text generation with a custom model
 */
export const modelStreamText = createAgentTool({
  name: "DECO_MODELS_V2_STREAM_TEXT",
  description:
    "Get a streaming URL for text generation with a custom model. Returns a URL that can be used to stream text responses.",
  inputSchema: z.object({
    modelUri: z.string().describe("Model resource URI (rsc://models/{id})"),
    messages: z.array(z.any()).optional().describe("Conversation messages"),
    temperature: z.number().optional().describe("Temperature (0-2)"),
    maxTokens: z.number().int().positive().optional().describe("Max tokens"),
    system: z.string().optional().describe("System prompt"),
  }),
  outputSchema: z.object({
    streamUrl: z.string().describe("URL to stream text responses"),
  }),
  handler: async ({ modelUri }, c) => {
    // Extract model ID from URI
    const modelId = modelUri.replace("rsc://models/", "").replace(/\.json$/, "");

    // Build streaming URL
    // Format: /:org/:project/models/:modelId/stream
    const org = c.locator?.org || "unknown";
    const project = c.locator?.project || "unknown";
    const streamUrl = `/${org}/${project}/models/${modelId}/stream`;

    return {
      streamUrl,
    };
  },
});

/**
 * DECO_MODELS_V2_GENERATE_TEXT
 * Generates text using a custom model (non-streaming)
 */
export const modelGenerateText = createAgentTool({
  name: "DECO_MODELS_V2_GENERATE_TEXT",
  description: "Generate text using a custom model (non-streaming response)",
  inputSchema: z.object({
    modelUri: z.string().describe("Model resource URI (rsc://models/{id})"),
    prompt: z.string().describe("Text prompt"),
    temperature: z.number().optional().describe("Temperature (0-2)"),
    maxTokens: z.number().int().positive().optional().describe("Max tokens"),
    system: z.string().optional().describe("System prompt"),
  }),
  outputSchema: z.object({
    text: z.string().describe("Generated text"),
    usage: z
      .object({
        promptTokens: z.number(),
        completionTokens: z.number(),
        totalTokens: z.number(),
      })
      .optional(),
  }),
  handler: async (_input, _c) => {
    // Placeholder implementation
    // The actual implementation would:
    // 1. Read model config from deconfig
    // 2. Initialize the model provider
    // 3. Generate text
    // 4. Return result with usage stats

    return {
      text: "Generated text placeholder",
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  },
});

/**
 * DECO_MODELS_V2_GENERATE_OBJECT
 * Generates a structured object using a custom model
 */
export const modelGenerateObject = createAgentTool({
  name: "DECO_MODELS_V2_GENERATE_OBJECT",
  description:
    "Generate a structured JSON object using a custom model with schema validation",
  inputSchema: z.object({
    modelUri: z.string().describe("Model resource URI (rsc://models/{id})"),
    prompt: z.string().describe("Generation prompt"),
    schema: z.any().describe("JSON schema for the output object"),
    temperature: z.number().optional().describe("Temperature (0-2)"),
    maxTokens: z.number().int().positive().optional().describe("Max tokens"),
    system: z.string().optional().describe("System prompt"),
  }),
  outputSchema: z.object({
    object: z.any().describe("Generated structured object"),
    usage: z
      .object({
        promptTokens: z.number(),
        completionTokens: z.number(),
        totalTokens: z.number(),
      })
      .optional(),
  }),
  handler: async (_input, _c) => {
    // Placeholder implementation
    // The actual implementation would:
    // 1. Read model config from deconfig
    // 2. Initialize the model provider
    // 3. Generate object with schema validation
    // 4. Return result with usage stats

    return {
      object: {},
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  },
});

// Export all custom tools
export const agentsV2CustomTools = [
  appendThreadMessage,
  modelStreamText,
  modelGenerateText,
  modelGenerateObject,
] as const;

