/**
 * CONNECTION_CREATE Tool
 * 
 * Create a new MCP connection (organization-scoped)
 */

import { z } from 'zod/v3';
import { defineTool } from '../../core/define-tool';
import { getUserId, requireAuth, requireOrganization } from '../../core/mesh-context';

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
    headers: z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    type: z.literal('Websocket'),
    url: z.string().url(),
    token: z.string().optional(),
  }),
]);

export const CONNECTION_CREATE = defineTool({
  name: 'CONNECTION_CREATE',
  description: 'Create a new MCP connection in the organization',
  
  inputSchema: z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    icon: z.string().url().optional(),
    connection: connectionSchema,
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    organizationId: z.string(),
    status: z.enum(['active', 'inactive', 'error']),
  }),
  
  handler: async (input, ctx) => {
    // Require authentication
    requireAuth(ctx);
    
    // Require organization context
    const organization = requireOrganization(ctx);
    
    // Check authorization
    await ctx.access.check();
    
    // Get user ID
    const userId = getUserId(ctx);
    if (!userId) {
      throw new Error('User ID required to create connection');
    }
    
    // Create connection
    const connection = await ctx.storage.connections.create({
      organizationId: organization.id,
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
      organizationId: connection.organizationId,
      status: connection.status,
    };
  },
});

