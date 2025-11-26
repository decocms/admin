/**
 * DECO_COLLECTION_CONNECTIONS_CREATE Tool
 *
 * Create a new MCP connection (organization-scoped) with collection binding compliance.
 */

import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import {
  getUserId,
  requireAuth,
  requireOrganization,
} from "../../core/mesh-context";
import {
  ConnectionEntitySchema,
  ConnectionCreateInputSchema,
  connectionToEntity,
} from "./schema";

/**
 * Input schema for creating connections (wrapped in data field for collection compliance)
 */
const CreateInputSchema = z.object({
  data: ConnectionCreateInputSchema.describe(
    "Data for the new connection (id is auto-generated)",
  ),
});

/**
 * Output schema for created connection
 */
const CreateOutputSchema = z.object({
  item: ConnectionEntitySchema.describe("The created connection entity"),
});

export const DECO_COLLECTION_CONNECTIONS_CREATE = defineTool({
  name: "DECO_COLLECTION_CONNECTIONS_CREATE",
  description: "Create a new MCP connection in the organization",

  inputSchema: CreateInputSchema,
  outputSchema: CreateOutputSchema,

  handler: async (input, ctx) => {
    // Require authentication
    requireAuth(ctx);

    // Require organization context
    const organization = requireOrganization(ctx);

    // Check authorization
    await ctx.access.check();

    // Get user ID
    const userId = getUserId(ctx);
    if (!userId) {
      throw new Error("User ID required to create connection");
    }

    const { data } = input;

    // Create connection - transform title back to name
    const connection = await ctx.storage.connections.create({
      organizationId: organization.id,
      createdById: userId,
      name: data.title, // Map title to name
      description: data.description,
      icon: data.icon,
      connection: data.connection,
      metadata: data.metadata,
    });

    return {
      item: connectionToEntity(connection),
    };
  },
});

/**
 * @deprecated Use DECO_COLLECTION_CONNECTIONS_CREATE instead
 */
export const CONNECTION_CREATE = DECO_COLLECTION_CONNECTIONS_CREATE;
