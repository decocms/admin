/**
 * COLLECTION_CONNECTIONS_UPDATE Tool
 *
 * Update an existing MCP connection (organization-scoped) with collection binding compliance.
 * Handles both regular connection updates and MCP configuration (state/scopes).
 */

import { z } from "zod";
import { createMCPProxy } from "../../api/routes/proxy";
import { defineTool } from "../../core/define-tool";
import { requireAuth, requireOrganization } from "../../core/mesh-context";
import {
  type ConnectionEntity,
  ConnectionEntitySchema,
  ConnectionUpdateDataSchema,
} from "./schema";
import { fetchToolsFromMCP } from "./fetch-tools";

/**
 * Input schema for updating connections
 */
const UpdateInputSchema = z.object({
  id: z.string().describe("ID of the connection to update"),
  data: ConnectionUpdateDataSchema.describe(
    "Partial connection data to update",
  ),
});

/**
 * Output schema for updated connection
 */
const UpdateOutputSchema = z.object({
  item: ConnectionEntitySchema.describe("The updated connection entity"),
});

/**
 * Parse scope string to extract key and scope name
 * Format: "KEY::SCOPE" where KEY is a key in the state object
 */
function parseScope(scope: string): [string, string] {
  const parts = scope.split("::");
  if (
    parts.length !== 2 ||
    typeof parts[0] !== "string" ||
    typeof parts[1] !== "string"
  ) {
    throw new Error(
      `Invalid scope format: ${scope}. Expected format: "KEY::SCOPE"`,
    );
  }
  return parts as [string, string];
}

export const COLLECTION_CONNECTIONS_UPDATE = defineTool({
  name: "COLLECTION_CONNECTIONS_UPDATE",
  description: "Update an existing MCP connection in the organization",

  inputSchema: UpdateInputSchema,
  outputSchema: UpdateOutputSchema,

  handler: async (input, ctx) => {
    // Require authentication
    requireAuth(ctx);

    // Require organization context
    const organization = requireOrganization(ctx);

    // Check authorization
    await ctx.access.check();

    const { id, data } = input;

    // First fetch the connection to verify ownership before updating
    const existing = await ctx.storage.connections.findById(id);

    // Verify it exists and belongs to the current organization
    if (!existing || existing.organization_id !== organization.id) {
      throw new Error("Connection not found in organization");
    }

    // Check if configuration fields are being updated
    const hasConfigurationUpdate =
      "configuration_state" in data || "configuration_scopes" in data;

    // Handle MCP configuration validation if configuration fields are present
    if (hasConfigurationUpdate) {
      const state =
        data.configuration_state ?? existing.configuration_state ?? {};
      const scopes =
        data.configuration_scopes ?? existing.configuration_scopes ?? [];

      // Parse scopes to extract cross-MCP references and validate them
      // Format: "KEY::SCOPE" where KEY is a key in the state object
      // and state[KEY].value contains a connection ID
      const referencedConnections = new Set<string>();

      for (const scope of scopes) {
        // Parse scope format: "KEY::SCOPE"
        const [key] = parseScope(scope);

        // Check if this key exists in state
        if (!(key in state)) {
          throw new Error(
            `Scope references key "${key}" but it's not present in state`,
          );
        }

        // Extract connection ID from state
        const stateValue = state[key];
        if (
          typeof stateValue === "object" &&
          stateValue !== null &&
          "value" in stateValue
        ) {
          const connectionIdRef = (stateValue as { value: unknown }).value;
          if (typeof connectionIdRef === "string") {
            referencedConnections.add(connectionIdRef);
          }
        }
      }

      // Validate all referenced connections
      for (const refConnectionId of referencedConnections) {
        if (refConnectionId === "self") {
          continue;
        }
        // Verify connection exists
        const refConnection =
          await ctx.storage.connections.findById(refConnectionId);
        if (!refConnection) {
          throw new Error(
            `Referenced connection not found: ${refConnectionId}`,
          );
        }

        // Verify connection belongs to same organization
        if (refConnection.organization_id !== organization.id) {
          throw new Error(
            `Referenced connection ${refConnectionId} does not belong to organization ${organization.id}`,
          );
        }

        // Verify user has access to the referenced connection
        // This checks if the user has permission to access this connection
        // by checking the "conn_<UUID>" resource in their permissions
        try {
          await ctx.access.check(refConnectionId);
        } catch (error) {
          throw new Error(
            `Access denied to referenced connection: ${refConnectionId}. ${
              (error as Error).message
            }`,
          );
        }
      }
    }

    // Fetch tools from the MCP server if connection fields changed
    const hasConnectionFieldChanges =
      "title" in data ||
      "connection_url" in data ||
      "connection_token" in data ||
      "connection_headers" in data;

    let tools = existing.tools;
    if (hasConnectionFieldChanges) {
      const fetchedTools = await fetchToolsFromMCP({
        id: existing.id,
        title: data.title ?? existing.title,
        connection_url: data.connection_url ?? existing.connection_url,
        connection_token: data.connection_token ?? existing.connection_token,
        connection_headers:
          data.connection_headers ?? existing.connection_headers,
      }).catch(() => null);
      tools = fetchedTools?.length ? fetchedTools : null;
    }

    // Update the connection
    const updatePayload: Partial<ConnectionEntity> = {
      ...data,
      ...(tools !== undefined && { tools }),
    };
    const connection = await ctx.storage.connections.update(id, updatePayload);

    // Invoke ON_MCP_CONFIGURATION callback if configuration was updated
    if (hasConfigurationUpdate) {
      const state = connection.configuration_state ?? {};
      const scopes = connection.configuration_scopes ?? [];

      // Ignore errors but await for the response before responding
      const proxy = await createMCPProxy(id, ctx);
      await proxy.client.callTool({
        name: "ON_MCP_CONFIGURATION",
        arguments: { state, scopes },
      });
    }

    return {
      item: connection,
    };
  },
});
