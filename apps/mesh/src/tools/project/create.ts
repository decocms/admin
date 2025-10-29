/**
 * PROJECT_CREATE Tool
 * 
 * Create a new project (namespace) in the organization
 */

import { z } from 'zod';
import { defineTool } from '../../core/define-tool';
import { getUserId, requireAuth } from '../../core/mesh-context';

export const PROJECT_CREATE = defineTool({
  name: 'PROJECT_CREATE',
  description: 'Create a new project (namespace) in the organization',

  inputSchema: z.object({
    slug: z.string()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    name: z.string().min(1).max(255),
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
    // Require authentication
    requireAuth(ctx);

    // Check authorization
    await ctx.access.check();

    // Get user ID
    const userId = getUserId(ctx);
    if (!userId) {
      throw new Error('User ID required to create project');
    }

    // Create project
    const project = await ctx.storage.projects.create({
      slug: input.slug,
      name: input.name,
      description: input.description,
      ownerId: userId,
    });

    return project;
  },
});

