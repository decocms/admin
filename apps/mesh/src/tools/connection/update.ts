/**
 * DECO_COLLECTION_CONNECTIONS_UPDATE Tool
 *
 * Update an existing MCP connection (organization-scoped) with collection binding compliance.
 */

import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { requireAuth, requireOrganization } from "../../core/mesh-context";
import {
  ConnectionEntitySchema,
  ConnectionUpdateDataSchema,
  connectionToEntity,
} from "./schema";

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

export const DECO_COLLECTION_CONNECTIONS_UPDATE = defineTool({
  name: "DECO_COLLECTION_CONNECTIONS_UPDATE",
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

    // Prepare update data - transform title to name
    const updateData: Partial<{
      name: string;
      description: string;
      icon: string;
      metadata: Record<string, unknown>;
      connectionType: string;
      connectionUrl: string;
      connectionToken: string;
      connectionHeaders: Record<string, string>;
    }> = {};

    if (data.title !== undefined) updateData.name = data.title; // Map title to name
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    if (data.connection) {
      updateData.connectionType = data.connection.type;
      updateData.connectionUrl = data.connection.url;
      if (data.connection.token) {
        updateData.connectionToken = data.connection.token;
      }
      if ("headers" in data.connection && data.connection.headers) {
        updateData.connectionHeaders = data.connection.headers;
      }
    }

    // Update connection
    const connection = await ctx.storage.connections.update(id, updateData);

    // Verify it belongs to the current organization
    if (connection.organizationId !== organization.id) {
      throw new Error("Connection not found in organization");
    }

    return {
      item: connectionToEntity(connection),
    };
  },
});

/**
 * @deprecated Use DECO_COLLECTION_CONNECTIONS_UPDATE instead
 */
export const CONNECTION_UPDATE = DECO_COLLECTION_CONNECTIONS_UPDATE;
