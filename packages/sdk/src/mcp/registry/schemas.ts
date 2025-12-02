import * as z from "zod";
import { MCPConnectionSchema } from "../../models/mcp.ts";

export const RegistryScopeSchema = z.lazy(() =>
  z.object({
    id: z.string(),
    scopeName: z.string(),
    workspace: z.string().nullable(),
    projectId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);

const RegistryToolSchema = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    inputSchema: z.record(z.unknown()),
    outputSchema: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
);

export const RegistryAppSchema = z.lazy(() =>
  z.object({
    id: z.string(),
    workspace: z.string().nullable(),
    scopeId: z.string(),
    scopeName: z.string(),
    appName: z.string(),
    name: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    connection: MCPConnectionSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    unlisted: z.boolean(),
    friendlyName: z.string().optional(),
    verified: z.boolean().optional(),
    tools: z.array(RegistryToolSchema).optional(),
    metadata: z.record(z.unknown()).optional().nullable(),
  }),
);

export type RegistryScope = z.infer<typeof RegistryScopeSchema>;
export type RegistryApp = z.infer<typeof RegistryAppSchema>;

/**
 * MCP Registry Spec Schemas
 * Follows: https://registry.modelcontextprotocol.io/docs#/operations/list-servers-v0.1
 */

/**
 * Deco-specific metadata stored in _meta.cx.decocms.registry
 */
export const DecoRegistryMetadataSchema = z.lazy(() =>
  z.object({
    id: z.string().describe("App ID from Deco registry"),
    scopeId: z.string(),
    scopeName: z.string(),
    workspace: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    verified: z.boolean().optional(),
    publishedAt: z.string().describe("ISO 8601 timestamp"),
    updatedAt: z.string().describe("ISO 8601 timestamp"),
    tools: z.array(RegistryToolSchema).optional(),
  }),
);

/**
 * MCP Registry Spec - Icon object
 */
export const MCPRegistryIconSchema = z.object({
  src: z.string().url(),
  mimeType: z.string(),
  sizes: z.array(z.string()).optional(),
  theme: z.enum(["light", "dark"]).optional(),
});

/**
 * MCP Registry Spec - Remote transport
 */
export const MCPRegistryRemoteSchema = z.object({
  type: z.enum(["http", "sse", "websocket"]),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

/**
 * MCP Registry Spec - Server object
 */
export const MCPRegistryServerSchema = z.object({
  $schema: z
    .string()
    .default(
      "https://static.modelcontextprotocol.io/schemas/2025-10-17/server.schema.json",
    ),
  name: z.string().describe("MCP server name (e.g., @deco/mcp-perplexity)"),
  title: z.string().describe("Human-readable title"),
  description: z.string().optional(),
  version: z.string().default("1.0.0"),
  icons: z.array(MCPRegistryIconSchema).optional(),
  remotes: z.array(MCPRegistryRemoteSchema),
  _meta: z
    .object({
      "cx.decocms.registry": DecoRegistryMetadataSchema.optional(),
    })
    .optional(),
});

/**
 * MCP Registry Spec - List response metadata
 */
export const MCPRegistryMetadataSchema = z.object({
  count: z.number().int().min(0),
  nextCursor: z.string().optional(),
});

/**
 * MCP Registry Spec - Full list response
 */
export const MCPRegistryListResponseSchema = z.object({
  metadata: MCPRegistryMetadataSchema,
  servers: z.array(
    z.object({
      _meta: z
        .object({
          "cx.decocms.registry": DecoRegistryMetadataSchema,
        })
        .optional(),
      server: MCPRegistryServerSchema,
    }),
  ),
});

export type DecoRegistryMetadata = z.infer<typeof DecoRegistryMetadataSchema>;
export type MCPRegistryIcon = z.infer<typeof MCPRegistryIconSchema>;
export type MCPRegistryRemote = z.infer<typeof MCPRegistryRemoteSchema>;
export type MCPRegistryServer = z.infer<typeof MCPRegistryServerSchema>;
export type MCPRegistryMetadata = z.infer<typeof MCPRegistryMetadataSchema>;
export type MCPRegistryListResponse = z.infer<
  typeof MCPRegistryListResponseSchema
>;

/**
 * MCP Registry Spec - Get response metadata
 * Metadata at root level for GET response
 */
export const MCPRegistryGetMetaSchema = z.object({
  isLatest: z.boolean().default(true),
  publishedAt: z.string().describe("ISO 8601 timestamp"),
  updatedAt: z.string().describe("ISO 8601 timestamp"),
  status: z.enum(["active", "deprecated", "archived"]).default("active"),
});

/**
 * MCP Registry Spec - Full GET response
 */
export const MCPRegistryGetResponseSchema = z.object({
  _meta: z.object({
    "cx.decocms.registry": MCPRegistryGetMetaSchema,
  }),
  server: MCPRegistryServerSchema,
});

export type MCPRegistryGetMeta = z.infer<typeof MCPRegistryGetMetaSchema>;
export type MCPRegistryGetResponse = z.infer<
  typeof MCPRegistryGetResponseSchema
>;

