/**
 * CONNECTION_TEST Tool
 *
 * Test connection health
 */

import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";

export const CONNECTION_TEST = defineTool({
  name: "CONNECTION_TEST",
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
