/**
 * CONNECTION_UPDATE Tool
 *
 * Update an existing MCP connection (organization-scoped)
 */

import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { requireAuth, requireOrganization } from "../../core/mesh-context";

const connectionSchema = z.discriminatedUnion("type", [
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
]);

export const CONNECTION_UPDATE = defineTool({
  name: "CONNECTION_UPDATE",
  description: "Update an existing MCP connection in the organization",

  inputSchema: z.object({
    id: z.string(),
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    icon: z.string().url().optional(),
    connection: connectionSchema.optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),

  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    organizationId: z.string(),
    status: z.enum(["active", "inactive", "error"]),
  }),

  handler: async (input, ctx) => {
    // Require authentication
    requireAuth(ctx);

    // Require organization context
    const organization = requireOrganization(ctx);

    // Check authorization
    await ctx.access.check();

    // Prepare update data
    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.icon !== undefined) updateData.icon = input.icon;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    if (input.connection) {
      updateData.connectionType = input.connection.type;
      updateData.connectionUrl = input.connection.url;
      if (input.connection.token) {
        updateData.connectionToken = input.connection.token;
      }
      if ("headers" in input.connection && input.connection.headers) {
        updateData.connectionHeaders = input.connection.headers;
      }
    }

    // Update connection
    const connection = await ctx.storage.connections.update(
      input.id,
      updateData,
    );

    // Verify it belongs to the current organization
    if (connection.organizationId !== organization.id) {
      throw new Error("Connection not found in organization");
    }

    return {
      id: connection.id,
      name: connection.name,
      organizationId: connection.organizationId,
      status: connection.status,
    };
  },
});
