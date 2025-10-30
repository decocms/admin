/**
 * CONNECTION_DELETE Tool
 * 
 * Delete a connection
 */

import { z } from 'zod/v3';
import { defineTool } from '../../core/define-tool';

export const CONNECTION_DELETE = defineTool({
  name: 'CONNECTION_DELETE',
  description: 'Delete a connection',

  inputSchema: z.object({
    id: z.string(),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    id: z.string(),
  }),

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

