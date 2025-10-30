/**
 * PROJECT_UPDATE Tool
 * 
 * Update an existing project
 */

import { z } from 'zod/v3';
import { defineTool } from '../../core/define-tool';

export const PROJECT_UPDATE = defineTool({
  name: 'PROJECT_UPDATE',
  description: 'Update an existing project',

  inputSchema: z.object({
    id: z.string(),
    slug: z.string()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
  }),

  outputSchema: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    ownerId: z.string(),
    createdAt: z.union([z.date(), z.string()]),
    updatedAt: z.union([z.date(), z.string()]),
  }),

  handler: async (input, ctx) => {
    // Check authorization
    await ctx.access.check();

    // Update project
    const project = await ctx.storage.projects.update(input.id, {
      slug: input.slug,
      name: input.name,
      description: input.description,
    });

    return project;
  },
});

