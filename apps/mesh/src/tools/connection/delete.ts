/**
 * DECO_COLLECTION_CONNECTIONS_DELETE Tool
 *
 * Delete a connection with collection binding compliance.
 */

import {
  CollectionDeleteInputSchema,
  CollectionDeleteOutputSchema,
} from "@decocms/bindings/collections";
import { defineTool } from "../../core/define-tool";

export const DECO_COLLECTION_CONNECTIONS_DELETE = defineTool({
  name: "DECO_COLLECTION_CONNECTIONS_DELETE",
  description: "Delete a connection",

  inputSchema: CollectionDeleteInputSchema,
  outputSchema: CollectionDeleteOutputSchema,

  handler: async (input, ctx) => {
    // Check authorization
    await ctx.access.check();

    // Delete connection
    await ctx.storage.connections.delete(input.id);

    return {
      success: true,
      id: input.id,
    };
  },
});

/**
 * @deprecated Use DECO_COLLECTION_CONNECTIONS_DELETE instead
 */
export const CONNECTION_DELETE = DECO_COLLECTION_CONNECTIONS_DELETE;
