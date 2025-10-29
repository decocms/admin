/**
 * PROJECT_DELETE Tool
 * 
 * Delete a project
 */

import { z } from 'zod';
import { defineTool } from '../../core/define-tool';

export const PROJECT_DELETE = defineTool({
  name: 'PROJECT_DELETE',
  description: 'Delete a project',
  
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
    
    // Delete project
    await ctx.storage.projects.delete(input.id);
    
    return {
      success: true,
      id: input.id,
    };
  },
});

