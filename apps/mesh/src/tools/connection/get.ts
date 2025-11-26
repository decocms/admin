/**
 * DECO_COLLECTION_CONNECTIONS_GET Tool
 *
 * Get connection details by ID with collection binding compliance.
 */

import {
  CollectionGetInputSchema,
  createCollectionGetOutputSchema,
} from "@decocms/bindings/collections";
import { defineTool } from "../../core/define-tool";
import { ConnectionEntitySchema, connectionToEntity } from "./schema";

/**
 * Output schema using the ConnectionEntitySchema
 */
const ConnectionGetOutputSchema = createCollectionGetOutputSchema(
  ConnectionEntitySchema,
);

export const DECO_COLLECTION_CONNECTIONS_GET = defineTool({
  name: "DECO_COLLECTION_CONNECTIONS_GET",
  description: "Get connection details by ID",

  inputSchema: CollectionGetInputSchema,
  outputSchema: ConnectionGetOutputSchema,

  handler: async (input, ctx) => {
    // Check authorization
    await ctx.access.check();

    // Get connection
    const connection = await ctx.storage.connections.findById(input.id);

    if (!connection) {
      return { item: null };
    }

    return {
      item: connectionToEntity(connection),
    };
  },
});

/**
 * @deprecated Use DECO_COLLECTION_CONNECTIONS_GET instead
 */
export const CONNECTION_GET = DECO_COLLECTION_CONNECTIONS_GET;
