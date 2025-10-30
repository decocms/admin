/**
 * PROJECT_LIST Tool
 * 
 * List all projects the user has access to
 */

import { z } from 'zod/v3';
import { defineTool } from '../../core/define-tool';
import { getUserId } from '../../core/mesh-context';

export const PROJECT_LIST = defineTool({
  name: 'PROJECT_LIST',
  description: 'List all projects user has access to',

  inputSchema: z.object({
    userId: z.string().optional(), // Optional: filter by specific user
  }),

  outputSchema: z.object({
    projects: z.array(z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      ownerId: z.string(),
      createdAt: z.union([z.date(), z.string()]),
      updatedAt: z.union([z.date(), z.string()]),
    })),
  }),

  handler: async (input, ctx) => {
    // Check authorization
    await ctx.access.check();

    // Filter by userId (input or current user)
    const userId = input.userId || getUserId(ctx);

    // List projects
    const projects = await ctx.storage.projects.list(userId);

    return { projects };
  },
});

