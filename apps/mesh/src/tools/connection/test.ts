/**
 * COLLECTION_CONNECTIONS_TEST Tool
 *
 * Test connection health
 */

import { z } from "zod";
import { defineTool } from "../../core/define-tool";

export const COLLECTION_CONNECTIONS_TEST = defineTool({
  name: "COLLECTION_CONNECTIONS_TEST",
  description: "Test connection health and latency",

  inputSchema: z.object({
    id: z.string(),
  }),

  outputSchema: z.object({
    id: z.string(),
    healthy: z.boolean(),
    latencyMs: z.number(),
  }),

  handler: async (input, ctx) => {
    // Check authorization
    await ctx.access.check();

    // Test connection
    const result = await ctx.storage.connections.testConnection(input.id);

    return {
      id: input.id,
      ...result,
    };
  },
});
