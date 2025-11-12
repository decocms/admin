import { z } from "zod";
import type { BaseResourceDataSchema } from "../resources-v2/bindings.ts";

/**
 * Agent V2 Data Schema
 * Simplified agent configuration focused on core functionality
 */
export const AgentV2DataSchema = z.object({
  name: z.string().min(1).describe("Agent name"),
  description: z.string().optional().describe("Agent description"),

  // System prompt
  system: z.string().describe("System prompt/instructions for the agent"),

  // Tools configuration - Record<integrationId, toolNames[]>
  tools: z
    .record(
      z.string().describe("Integration ID (e.g., 'i:github', 'i:slack')"),
      z
        .array(z.string())
        .describe(
          "Array of tool names from this integration. Empty array = all tools",
        ),
    )
    .default({})
    .describe("Tools available to the agent by integration"),
}) satisfies BaseResourceDataSchema;

export type AgentV2Data = z.infer<typeof AgentV2DataSchema>;

/**
 * Thread V2 Data Schema
 * Simplified thread schema for conversation storage
 */
export const ThreadV2DataSchema = z.object({
  name: z.string().min(1).describe("Thread title/name"),
  description: z.string().optional().describe("Thread description"),

  // Core data
  agentId: z
    .string()
    .optional()
    .describe("Optional agent ID (URI or UUID) associated with this thread"),
  messages: z
    .array(z.any())
    .default([])
    .describe("Conversation messages (AI SDK UIMessage format)"),
}) satisfies BaseResourceDataSchema;

export type ThreadV2Data = z.infer<typeof ThreadV2DataSchema>;

/**
 * Model V2 Data Schema
 * Custom model configuration for workspace-scoped BYOK models
 */
export const ModelV2DataSchema = z.object({
  name: z.string().min(1).describe("Model display name"),
  description: z.string().optional().describe("Model description"),

  // Provider configuration
  provider: z
    .string()
    .describe("Provider name (e.g., 'anthropic', 'openai', 'custom')"),
  modelId: z
    .string()
    .describe(
      "Provider-specific model identifier (e.g., 'claude-3-5-sonnet-20241022')",
    ),

  // Capabilities - flexible array of supported features
  supports: z
    .array(z.string())
    .default([])
    .describe(
      "Array of capabilities (e.g., ['streaming', 'vision', 'tool-calling', 'reasoning'])",
    ),

  // Limits and defaults - flexible key-value configuration
  limits: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "Limit name (e.g., 'contextWindow', 'maxTokens', 'defaultTemperature')",
          ),
        value: z.string().describe("Limit value as string"),
      }),
    )
    .optional()
    .default([])
    .describe("Model limits and default values"),

  // Pricing (for observability)
  price: z
    .object({
      input: z.number().describe("Cost per 1M input tokens in USD"),
      output: z.number().describe("Cost per 1M output tokens in USD"),
    })
    .optional()
    .describe("Pricing information"),
}) satisfies BaseResourceDataSchema;

export type ModelV2Data = z.infer<typeof ModelV2DataSchema>;

