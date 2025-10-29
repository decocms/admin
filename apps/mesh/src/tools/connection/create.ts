/**
 * CONNECTION_CREATE Tool
 * 
 * Create a new MCP connection (organization or project scoped)
 */

import { z } from 'zod';
import { defineTool } from '../../core/define-tool';
import { getUserId, requireAuth, getProjectId } from '../../core/mesh-context';

const connectionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('HTTP'),
    url: z.string().url(),
    token: z.string().optional(),
  }),
  z.object({
    type: z.literal('SSE'),
    url: z.string().url(),
    token: z.string().optional(),
    headers: z.record(z.string()).optional(),
  }),
  z.object({
    type: z.literal('Websocket'),
    url: z.string().url(),
    token: z.string().optional(),
  }),
]);

export const CONNECTION_CREATE = defineTool({
  name: 'CONNECTION_CREATE',
  description: 'Create a new MCP connection (organization or project scoped)',
  
  inputSchema: z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    icon: z.string().url().optional(),
    projectId: z.string().nullable().optional(), // null = org-scoped, undefined = use context
    connection: connectionSchema,
    metadata: z.record(z.any()).optional(),
  }),
  
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    scope: z.enum(['organization', 'project']),
    status: z.enum(['active', 'inactive', 'error']),
  }),
  
  handler: async (input, ctx) => {
    // Require authentication
    requireAuth(ctx);
    
    // Check authorization
    await ctx.access.check();
    
    // Get user ID
    const userId = getUserId(ctx);
    if (!userId) {
      throw new Error('User ID required to create connection');
    }
    
    // Determine project scope
    const projectId = input.projectId !== undefined 
      ? input.projectId 
      : getProjectId(ctx);
    
    // Create connection
    const connection = await ctx.storage.connections.create({
      projectId,
      createdById: userId,
      name: input.name,
      description: input.description,
      icon: input.icon,
      connection: input.connection,
      metadata: input.metadata,
    });
    
    return {
      id: connection.id,
      name: connection.name,
      scope: connection.projectId ? 'project' : 'organization',
      status: connection.status,
    };
  },
});

