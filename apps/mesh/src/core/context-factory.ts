/**
 * Context Factory
 * 
 * Creates MeshContext instances from HTTP requests (via Hono Context).
 * Handles:
 * - API key verification
 * - Project scope extraction
 * - Storage adapter initialization
 * - Base URL derivation
 */

import type { Meter, Tracer } from '@opentelemetry/api';
import type { Context } from 'hono';
import type { Kysely } from 'kysely';
import { ConnectionStorage } from '../storage/connection';
import { ProjectStorage } from '../storage/project';
import type { Database } from '../storage/types';
import { AccessControl } from './access-control';
import type { BetterAuthInstance, CredentialVault, MeshContext } from './mesh-context';

// ============================================================================
// Configuration
// ============================================================================

export interface MeshContextConfig {
  db: Kysely<Database>;
  auth: BetterAuthInstance;
  encryption: {
    key: string;
  };
  observability: {
    tracer: Tracer;
    meter: Meter;
  };
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Unauthorized error
 */
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// ============================================================================
// Context Factory
// ============================================================================

/**
 * Create a context factory function
 * 
 * The factory creates storage adapters once (singleton pattern) and
 * returns a function that creates MeshContext from Hono Context
 */
export function createMeshContextFactory(
  config: MeshContextConfig
): (c: Context) => Promise<MeshContext> {
  // Create storage adapters once (singleton pattern)
  const storage = {
    projects: new ProjectStorage(config.db),
    connections: new ConnectionStorage(config.db),
    // Add other storage classes as implemented
    policies: undefined,
    roles: undefined,
    tokens: undefined,
    tokenRevocations: undefined,
    auditLogs: undefined,
  };

  // Create vault instance (placeholder - to be implemented in Task 10)
  const vault: CredentialVault = null as any;

  // Return factory function
  return async (c: Context): Promise<MeshContext> => {
    // Extract API key from Authorization header
    const authHeader = c.req.header('Authorization');
    const key = authHeader?.replace('Bearer ', '');

    let auth: MeshContext['auth'] = {};

    if (key) {
      // Verify API key with Better Auth
      // For now, we'll skip this since Better Auth isn't set up yet
      // This will be implemented in Task 09

      // Placeholder for Better Auth verification
      if (config.auth?.api?.verifyApiKey) {
        const result = await config.auth.api.verifyApiKey({
          body: { key },
        });

        if (!result.valid) {
          throw new UnauthorizedError(
            result.error?.message || 'Invalid API key'
          );
        }

        auth = {
          apiKey: {
            id: result.key.id,
            name: result.key.name,
            userId: result.key.userId,
            permissions: result.key.permissions || {},
            metadata: result.key.metadata,
            remaining: result.key.remaining,
            expiresAt: result.key.expiresAt,
          },
        };
      }
    }

    // Extract project from path (e.g., /:projectSlug/mcp/...)
    const projectSlug = extractProjectSlug(c.req.path);
    let project: MeshContext['project'] | undefined;

    if (projectSlug) {
      // Load project
      const foundProject = await storage.projects.findBySlug(projectSlug);

      if (!foundProject) {
        throw new NotFoundError(`Project not found: ${projectSlug}`);
      }

      // Verify API key has project access
      if (auth.apiKey) {
        const hasProjectAccess =
          auth.apiKey.permissions['mcp']?.some(tool =>
            tool.startsWith('PROJECT_')
          ) ||
          auth.apiKey.permissions[`project:${foundProject.id}`]?.length > 0;

        if (!hasProjectAccess) {
          throw new UnauthorizedError(
            `API key does not have access to project: ${projectSlug}`
          );
        }
      }

      project = {
        id: foundProject.id,
        slug: foundProject.slug,
        ownerId: foundProject.ownerId,
      };
    }

    // Derive base URL from request
    const url = new URL(c.req.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    // Create AccessControl instance
    const access = new AccessControl(
      config.auth,
      auth.user?.id,
      undefined, // toolName set later by defineTool
      auth.apiKey?.permissions,
      auth.user?.role,
      undefined // connectionId set when proxying
    );

    return {
      auth,
      project,
      storage,
      vault,
      authInstance: config.auth,
      access,
      db: config.db,
      tracer: config.observability.tracer,
      meter: config.observability.meter,
      baseUrl,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        userAgent: c.req.header('User-Agent'),
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      },
    };
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract project slug from request path
 * Returns undefined for organization-scoped paths
 * 
 * Pattern: /:projectSlug/mcp/...
 */
function extractProjectSlug(path: string): string | undefined {
  // Ignore if path starts with /mcp (organization-scoped)
  if (path.startsWith('/mcp')) {
    return undefined;
  }

  // Pattern: /:projectSlug/mcp/...
  const match = path.match(/^\/([^\/]+)\/mcp/);
  return match?.[1];
}

