/**
 * COLLECTION_CONNECTIONS_UPDATE Tool
 *
 * Update an existing MCP connection (organization-scoped) with collection binding compliance.
 */

import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { requireAuth, requireOrganization } from "../../core/mesh-context";
import { ConnectionEntitySchema, ConnectionUpdateDataSchema } from "./schema";
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

    // Always fetch tools from the MCP server
    const tools = await fetchToolsFromMCP({
      id: existing.id,
      title: data.title ?? existing.title,
      connection_url: data.connection_url ?? existing.connection_url,
      connection_token: data.connection_token ?? existing.connection_token,
      connection_headers:
        data.connection_headers ?? existing.connection_headers,
    });

    if (!tools || tools.length === 0) {
      throw new Error(
        "Failed to fetch tools from the MCP server. Please verify the connection URL and credentials.",
      );
    }

    // Update the connection with the refreshed tools
    const connection = await ctx.storage.connections.update(id, {
      ...data,
      tools,
    } as never);

    return {
      item: connection,
    };
  },
});
