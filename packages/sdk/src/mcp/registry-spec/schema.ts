import { z } from "zod";

/**
 * MCP Registry Spec Types
 * Based on: https://registry.modelcontextprotocol.io/docs#/schemas/
 *
 * Defines the contract that any MCP server must follow
 * to be compatible with the official MCP registry.
 */

/**
 * Original Deco backend data preserved in metadata
 */
export const DecoOriginalDataSchema = z.object({
  appName: z.string().optional().nullable(),
  appId: z.string().optional().nullable(),
  connection: z.unknown().optional(),
  access: z.string().optional().nullable(),
}).optional().describe("Original Deco data for backward compatibility");

export type DecoOriginalData = z.infer<typeof DecoOriginalDataSchema>;

/**
 * Tool/resource offered by an MCP server
 */
export const MCPRegistryToolSchema = z.object({
  name: z.string().describe("Unique tool name"),
  description: z.string().optional().describe("Description of what the tool does"),
  inputSchema: z.unknown().optional().describe("JSON schema for input (as per JSON Schema spec)"),
  outputSchema: z.unknown().optional().describe("JSON schema for output (as per JSON Schema spec)"),
});

export type MCPRegistryTool = z.infer<typeof MCPRegistryToolSchema>;

/**
 * Author/contact information
 */
export const MCPRegistryAuthorSchema = z.object({
  name: z.string().describe("Author name"),
  url: z.string().url().optional().describe("Author URL"),
  email: z.string().email().optional().describe("Author email"),
});

export type MCPRegistryAuthor = z.infer<typeof MCPRegistryAuthorSchema>;

/**
 * MCP server in registry
 * Represents an MCP integration/app compatible with the official spec
 * See: https://registry.modelcontextprotocol.io/docs#/schemas
 */
export const MCPRegistryServerSchema = z.object({
  // Identification (required)
  id: z.string().describe("Unique server ID in registry"),
  name: z.string().describe("Public server name"),

  // Description (optional)
  description: z.string().optional().describe("Detailed description of the server"),

  // Presentation (optional)
  icon: z.string().url().optional().describe("URL to server icon (SVG or PNG)"),
  homepage: z.string().url().optional().describe("Server homepage URL"),

  // Author information (optional)
  author: MCPRegistryAuthorSchema.optional().describe("Author/maintainer information"),

  // Metadata (optional)
  license: z.string().optional().describe("SPDX license identifier"),
  version: z.string().optional().describe("Server version (semver format)"),

  // Classification (optional)
  tags: z.array(z.string()).optional().describe("Tags for categorization and discovery"),
  capabilities: z
    .array(z.enum(["tools", "resources", "prompts", "roots"]))
    .optional()
    .describe("Server capabilities according to MCP spec"),

  // Status (optional)
  verified: z.boolean().optional().describe("Verified by Anthropic/registry maintainer"),
  featured: z.boolean().optional().describe("Featured in registry"),
  deprecated: z.boolean().optional().describe("Server is deprecated"),

  // Timestamps (optional)
  createdAt: z.string().datetime().optional().describe("Creation timestamp"),
  updatedAt: z.string().datetime().optional().describe("Last update timestamp"),

  // Custom metadata (for Deco backend compatibility only)
  metadata: z.record(z.unknown()).optional().describe("Custom metadata for extensions"),
});

export type MCPRegistryServer = z.infer<typeof MCPRegistryServerSchema>;

/**
 * Binding definition (contract that a server must implement)
 */
export const MCPRegistryBindingSchema = z.object({
  id: z.string().describe("Unique binding ID"),
  name: z.string().describe("Binding name"),
  description: z.string().optional().describe("What the binding provides"),
  tools: z.array(MCPRegistryToolSchema).describe("Required tools"),
  version: z.string().optional().describe("Binding version"),
});

export type MCPRegistryBinding = z.infer<typeof MCPRegistryBindingSchema>;

/**
 * Registry search response
 */
export const MCPRegistrySearchResponseSchema = z.object({
  servers: z
    .array(MCPRegistryServerSchema)
    .describe("Servers found"),
  total: z.number().optional().describe("Total number of available servers"),
  hasMore: z.boolean().optional().describe("More results available"),
  pageToken: z.string().optional().describe("Token for next page"),
});

export type MCPRegistrySearchResponse = z.infer<
  typeof MCPRegistrySearchResponseSchema
>;

/**
 * Validate a server against the schema
 */
export function validateMCPRegistryServer(
  data: unknown
): { valid: true; data: MCPRegistryServer } | { valid: false; error: string } {
  try {
    const server = MCPRegistryServerSchema.parse(data);
    return { valid: true, data: server };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Validation failed",
    };
  }
}

/**
 * Validate a search response
 */
export function validateMCPRegistrySearchResponse(
  data: unknown
): { valid: true; data: MCPRegistrySearchResponse } | { valid: false; error: string } {
  try {
    const response = MCPRegistrySearchResponseSchema.parse(data);
    return { valid: true, data: response };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Validation failed",
    };
  }
}

