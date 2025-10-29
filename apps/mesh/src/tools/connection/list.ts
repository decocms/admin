/**
 * CONNECTION_LIST Tool
 * 
 * List all connections available (org + project scoped)
 */

import { z } from 'zod';
import { defineTool } from '../../core/define-tool';
import { getProjectId } from '../../core/mesh-context';

export const CONNECTION_LIST = defineTool({
  name: 'CONNECTION_LIST',
  description: 'List all connections available in current scope',
  
  inputSchema: z.object({
    scope: z.enum(['all', 'organization', 'project']).optional().default('all'),
  }),
  
  outputSchema: z.object({
    connections: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      scope: z.enum(['organization', 'project']),
      status: z.enum(['active', 'inactive', 'error']),
      connectionType: z.enum(['HTTP', 'SSE', 'Websocket']),
      connectionUrl: z.string(),
    })),
  }),
  
  handler: async (input, ctx) => {
    // Check authorization
    await ctx.access.check();
    
    // Get project ID from context
    const projectId = getProjectId(ctx);
    
    // List connections
    const connections = await ctx.storage.connections.list(
      projectId,
      input.scope
    );
    
    // Map to output format
    return {
      connections: connections.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        scope: c.projectId ? 'project' as const : 'organization' as const,
        status: c.status,
        connectionType: c.connectionType,
        connectionUrl: c.connectionUrl,
      })),
    };
  },
});

