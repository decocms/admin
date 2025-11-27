/**
 * Agents Well-Known Binding
 *
 * Defines the interface for AI agent providers.
 * Any MCP that implements this binding can provide configurable AI agents
 * with custom instructions and tool access controls.
 *
 * This binding uses collection bindings for LIST and GET operations (read-only).
 */

import { z } from "zod";
import type { Binder } from "../core/binder";
import {
  BaseCollectionEntitySchema,
  createCollectionBindings,
} from "./collections";

/**
 * Agent entity schema for AI agents
 * Extends BaseCollectionEntitySchema with agent-specific fields
 * Base schema already includes: id, title, created_at, updated_at, created_by, updated_by
 */
export const AgentSchema = BaseCollectionEntitySchema.extend({
  // Agent-specific fields
  description: z.string().describe("Brief description of the agent's purpose"),
  instructions: z
    .string()
    .describe("System instructions that define the agent's behavior"),
  tool_set: z
    .record(z.string(), z.array(z.string()))
    .describe(
      "Map of connection IDs to arrays of allowed tool names for this agent",
    ),
  avatar: z.string().url().describe("URL to the agent's avatar image"),
});

/**
 * AGENTS Collection Binding
 *
 * Collection bindings for agents (read-only).
 * Provides LIST and GET operations for AI agents.
 */
export const AGENTS_COLLECTION_BINDING = createCollectionBindings(
  "agents",
  AgentSchema,
  { readOnly: true },
);

/**
 * AGENTS Binding
 *
 * Defines the interface for AI agent providers.
 * Any MCP that implements this binding can provide configurable AI agents.
 *
 * Required tools:
 * - COLLECTION_AGENTS_LIST: List available AI agents with their configurations
 * - COLLECTION_AGENTS_GET: Get a single agent by ID (includes instructions and tool_set)
 */
export const AGENTS_BINDING = [
  ...AGENTS_COLLECTION_BINDING,
] as const satisfies Binder;
