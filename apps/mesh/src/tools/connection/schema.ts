/**
 * Connection Entity Schema
 *
 * Defines the schema for connections that complies with the collections binding pattern.
 * Maps MCPConnection fields to collection entity structure.
 */

import { z } from "zod/v3";
import type { MCPConnection } from "../../storage/types";

/**
 * Connection entity schema compliant with collections binding.
 * Uses `title` instead of `name` to match BaseCollectionEntitySchema.
 */
export const ConnectionEntitySchema = z.object({
  // Base collection entity fields
  id: z.string().describe("Unique identifier for the connection"),
  title: z.string().describe("Human-readable name for the connection"),
  created_at: z.string().datetime().describe("When the connection was created"),
  updated_at: z
    .string()
    .datetime()
    .describe("When the connection was last updated"),
  created_by: z
    .string()
    .optional()
    .describe("User ID who created the connection"),
  updated_by: z
    .string()
    .optional()
    .describe("User ID who last updated the connection"),

  // Connection-specific fields
  organizationId: z
    .string()
    .describe("Organization ID this connection belongs to"),
  description: z.string().nullable().describe("Description of the connection"),
  icon: z
    .string()
    .url()
    .nullable()
    .optional()
    .describe("Icon URL for the connection"),
  appName: z.string().nullable().optional().describe("Associated app name"),
  appId: z.string().nullable().optional().describe("Associated app ID"),

  connectionType: z
    .enum(["HTTP", "SSE", "Websocket"])
    .describe("Type of connection"),
  connectionUrl: z.string().url().describe("URL for the connection"),
  connectionToken: z
    .string()
    .nullable()
    .optional()
    .describe("Authentication token (encrypted)"),
  connectionHeaders: z
    .record(z.string(), z.string())
    .nullable()
    .optional()
    .describe("Custom headers"),

  oauthConfig: z
    .record(z.unknown())
    .nullable()
    .optional()
    .describe("OAuth configuration"),
  metadata: z
    .record(z.unknown())
    .nullable()
    .optional()
    .describe("Additional metadata"),
  tools: z
    .array(z.any())
    .nullable()
    .optional()
    .describe("Discovered tools from MCP"),
  bindings: z
    .array(z.string())
    .nullable()
    .optional()
    .describe("Detected bindings"),

  status: z
    .enum(["active", "inactive", "error"])
    .describe("Current status of the connection"),
});

/**
 * Type for the collection entity format
 */
export type ConnectionEntity = z.infer<typeof ConnectionEntitySchema>;

/**
 * Transform MCPConnection to collection entity format
 * Maps: name → title, createdById → created_by, timestamps to ISO strings
 */
export function connectionToEntity(
  connection: MCPConnection,
): ConnectionEntity {
  return {
    id: connection.id,
    title: connection.name, // Map name to title
    created_at:
      typeof connection.createdAt === "string"
        ? connection.createdAt
        : connection.createdAt.toISOString(),
    updated_at:
      typeof connection.updatedAt === "string"
        ? connection.updatedAt
        : connection.updatedAt.toISOString(),
    created_by: connection.createdById, // Map createdById to created_by
    updated_by: undefined, // Not tracked in MCPConnection currently
    organizationId: connection.organizationId,
    description: connection.description,
    icon: connection.icon,
    appName: connection.appName,
    appId: connection.appId,
    connectionType: connection.connectionType,
    connectionUrl: connection.connectionUrl,
    connectionToken: connection.connectionToken,
    connectionHeaders: connection.connectionHeaders,
    oauthConfig: connection.oauthConfig as Record<string, unknown> | null,
    metadata: connection.metadata,
    tools: connection.tools,
    bindings: connection.bindings,
    status: connection.status,
  };
}

/**
 * Partial input schema for creating connections (title instead of name, some fields optional)
 */
export const ConnectionCreateInputSchema = z.object({
  title: z.string().min(1).max(255).describe("Name of the connection"),
  description: z.string().optional().describe("Description of the connection"),
  icon: z.string().url().optional().describe("Icon URL for the connection"),
  connection: z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("HTTP"),
        url: z.string().url(),
        token: z.string().optional(),
      }),
      z.object({
        type: z.literal("SSE"),
        url: z.string().url(),
        token: z.string().optional(),
        headers: z.record(z.string(), z.string()).optional(),
      }),
      z.object({
        type: z.literal("Websocket"),
        url: z.string().url(),
        token: z.string().optional(),
      }),
    ])
    .describe("Connection configuration"),
  metadata: z
    .record(z.string(), z.any())
    .optional()
    .describe("Additional metadata"),
});

/**
 * Partial input schema for updating connections
 */
export const ConnectionUpdateDataSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(255)
    .optional()
    .describe("Name of the connection"),
  description: z.string().optional().describe("Description of the connection"),
  icon: z.string().url().optional().describe("Icon URL for the connection"),
  connection: z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("HTTP"),
        url: z.string().url(),
        token: z.string().optional(),
      }),
      z.object({
        type: z.literal("SSE"),
        url: z.string().url(),
        token: z.string().optional(),
        headers: z.record(z.string(), z.string()).optional(),
      }),
      z.object({
        type: z.literal("Websocket"),
        url: z.string().url(),
        token: z.string().optional(),
      }),
    ])
    .optional()
    .describe("Connection configuration"),
  metadata: z
    .record(z.string(), z.any())
    .optional()
    .describe("Additional metadata"),
});
