/**
 * DECO_COLLECTION_CONNECTIONS_DELETE Tool
 *
 * Delete a connection with collection binding compliance.
 */

import {
  CollectionDeleteInputSchema,
  createCollectionDeleteOutputSchema,
} from "@decocms/bindings/collections";
import { defineTool } from "../../core/define-tool";
import { connectionToEntity, ConnectionEntitySchema } from "./schema";

export const DECO_COLLECTION_CONNECTIONS_DELETE = defineTool({
  name: "DECO_COLLECTION_CONNECTIONS_DELETE",
  description: "Delete a connection",

  inputSchema: CollectionDeleteInputSchema,
  outputSchema: createCollectionDeleteOutputSchema(ConnectionEntitySchema),

  handler: async (input, ctx) => {
    // Check authorization
    await ctx.access.check();

    // Fetch connection before deleting to return the entity
    const connection = await ctx.storage.connections.findById(input.id);
    if (!connection) {
      throw new Error(`Connection not found: ${input.id}`);
    }

    // Delete connection
    await ctx.storage.connections.delete(input.id);

    return {
      item: connectionToEntity(connection),
    };
  },
});

/**
 * @deprecated Use DECO_COLLECTION_CONNECTIONS_DELETE instead
 */
export const CONNECTION_DELETE = DECO_COLLECTION_CONNECTIONS_DELETE;
