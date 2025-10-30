/**
 * CONNECTION_GET Tool
 * 
 * Get connection details by ID
 */

import { z } from 'zod/v3';
import { defineTool } from '../../core/define-tool';

export const CONNECTION_GET = defineTool({
  name: 'CONNECTION_GET',
  description: 'Get connection details by ID',
  
  inputSchema: z.object({
    id: z.string(),
  }),
  
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    scope: z.enum(['organization', 'project']),
    status: z.enum(['active', 'inactive', 'error']),
    connectionType: z.enum(['HTTP', 'SSE', 'Websocket']),
    connectionUrl: z.string(),
    tools: z.array(z.any()).nullable(),
    bindings: z.array(z.string()).nullable(),
  }),
  
  handler: async (input, ctx) => {
    // Check authorization
    await ctx.access.check();
    
    // Get connection
    const connection = await ctx.storage.connections.findById(input.id);
    
    if (!connection) {
      throw new Error(`Connection not found: ${input.id}`);
    }
    
    return {
      id: connection.id,
      name: connection.name,
      description: connection.description,
      scope: (connection.projectId ? 'project' : 'organization') as 'organization' | 'project',
      status: connection.status,
      connectionType: connection.connectionType,
      connectionUrl: connection.connectionUrl,
      tools: connection.tools,
      bindings: connection.bindings,
    };
  },
});

