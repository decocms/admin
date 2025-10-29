/**
 * PROJECT_GET Tool
 * 
 * Get project details by slug or ID
 */

import { z } from 'zod';
import { defineTool } from '../../core/define-tool';

export const PROJECT_GET = defineTool({
  name: 'PROJECT_GET',
  description: 'Get project details by slug or ID',
  
  inputSchema: z.object({
    slug: z.string().optional(),
    id: z.string().optional(),
  }).refine(
    (data) => data.slug || data.id,
    { message: 'Either slug or id must be provided' }
  ),
  
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
    
    // Find project
    let project;
    if (input.slug) {
      project = await ctx.storage.projects.findBySlug(input.slug);
    } else if (input.id) {
      project = await ctx.storage.projects.findById(input.id);
    }
    
    if (!project) {
      throw new Error(`Project not found: ${input.slug || input.id}`);
    }
    
    return project;
  },
});

