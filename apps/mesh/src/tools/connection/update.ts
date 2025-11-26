/**
 * COLLECTION_CONNECTIONS_UPDATE Tool
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

    // Prepare update data - transform entity schema fields to storage format
    // Note: Storage layer uses undefined for optional fields, not null
    const updateData: {
      name?: string;
      description?: string;
      icon?: string;
      metadata?: Record<string, unknown>;
      connectionToken?: string;
      status?: "active" | "inactive" | "error";
    } = {};

    // Map entity schema fields to storage fields (convert null to undefined)
    if (data.title !== undefined) updateData.name = data.title;
    if (data.description !== undefined)
      updateData.description = data.description ?? undefined;
    if (data.icon !== undefined) updateData.icon = data.icon ?? undefined;
    if (data.metadata !== undefined)
      updateData.metadata =
        (data.metadata as Record<string, unknown>) ?? undefined;
    if (data.connectionToken !== undefined)
      updateData.connectionToken = data.connectionToken ?? undefined;
    if (data.status !== undefined) updateData.status = data.status;

    // First fetch the connection to verify ownership before updating
    const existing = await ctx.storage.connections.findById(id);

    // Verify it exists and belongs to the current organization
    if (!existing || existing.organizationId !== organization.id) {
      throw new Error("Connection not found in organization");
    }

    // Now update - safe because we verified ownership first
    const connection = await ctx.storage.connections.update(id, updateData);

    return {
      item: connectionToEntity(connection),
    };
  },
});

/**
 * @deprecated Use COLLECTION_CONNECTIONS_UPDATE instead
 */
export const CONNECTION_UPDATE = COLLECTION_CONNECTIONS_UPDATE;
