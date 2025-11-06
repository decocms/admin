/**
 * CONNECTION_LIST Tool
 *
 * List all connections in the organization
 */

import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { requireOrganization } from "../../core/mesh-context";

export const CONNECTION_LIST = defineTool({
  name: "CONNECTION_LIST",
  description: "List all connections in the organization",

  inputSchema: z.object({
    // No scope parameter needed - all connections are org-scoped
  }),

  outputSchema: z.object({
    connections: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        organizationId: z.string(),
        status: z.enum(["active", "inactive", "error"]),
        connectionType: z.enum(["HTTP", "SSE", "Websocket"]),
        connectionUrl: z.string(),
      }),
    ),
  }),

  handler: async (_input, ctx) => {
    // Check authorization
    await ctx.access.check();

    // Require organization context
    const organization = requireOrganization(ctx);

    // List connections for this organization
    const connections = await ctx.storage.connections.list(organization.id);

    // Map to output format
    return {
      connections: connections.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        organizationId: c.organizationId,
        status: c.status,
        connectionType: c.connectionType,
        connectionUrl: c.connectionUrl,
      })),
    };
  },
});
