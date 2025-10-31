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
import { AuditLogStorage } from '../storage/audit-log';
import { RoleStorage } from '../storage/role';
import type { Database } from '../storage/types';
import { AccessControl } from './access-control';
import type { MeshContext, BetterAuthInstance } from './mesh-context';
import { CredentialVault } from '../encryption/credential-vault';

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
// Types
// ============================================================================

/**
 * OAuth Session from Better Auth MCP plugin
 * Returned by auth.api.getMcpSession()
 */
interface OAuthSession {
  id: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  clientId: string;
  userId: string;
  scopes: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Parse OAuth scopes into Better Auth permission format
 * 
 * Input: "openid profile email mcp:*"
 * Output: { "mcp": ["*"] }
 * 
 * Input: "openid profile email mcp:PROJECT_CREATE mcp:CONNECTION_LIST"
 * Output: { "mcp": ["PROJECT_CREATE", "CONNECTION_LIST"] }
 */
function scopesToPermissions(scopes: string): Record<string, string[]> {
  const permissions: Record<string, string[]> = {};

  // Split scopes and filter for mcp: prefixed ones
  const scopeList = scopes.split(' ').filter(s => s.trim());

  for (const scope of scopeList) {
    const [connection, tool] = scope.split(':');
    if (connection && tool) {
      if (!permissions[connection]) {
        permissions[connection] = [];
      }
      permissions[connection].push(tool);
    }
  }

  return permissions;
}

/**
 * Authenticate request using either OAuth session or API key
 * Returns unified authentication data
 */
async function authenticateRequest(
  c: Context,
  auth: BetterAuthInstance
): Promise<{
  user?: any;
  permissions: Record<string, string[]>;
  role?: string;
  apiKeyId?: string;
}> {
  const authHeader = c.req.header('Authorization');

  // Try OAuth session first (getMcpSession)
  try {
    const session = await auth.api.getMcpSession({
      headers: c.req.raw.headers,
    }) as OAuthSession | null;

    if (session) {
      // Parse OAuth scopes into permissions
      const scopes = session.scopes || '';
      const permissions = scopesToPermissions(scopes);

      // Load user from userId in session
      const userId = session.userId;
      return {
        user: { id: userId }, // Minimal user object
        permissions,
      };
    }
  } catch (error) {
    const err = error as Error;
    console.log('[Auth] OAuth session check failed:', err.message);
  }

  // Try API Key authentication
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.replace('Bearer ', '').trim();
      const result = await auth.api.verifyApiKey({
        body: { key: token },
      });

      if (result?.valid && result.key) {
        console.log('[Auth] API key authenticated:', {
          keyName: result.key.name,
          permissions: result.key.permissions,
        });

        return {
          permissions: result.key.permissions || {},
          apiKeyId: result.key.id,
        };
      }
    } catch (error: any) {
      console.log('[Auth] API key check failed:', error.message);
    }
  }

  // No valid authentication found
  throw new UnauthorizedError('Authentication required. Please provide a valid OAuth token or API key.');
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
    auditLogs: new AuditLogStorage(config.db),
    roles: new RoleStorage(config.db),
    // Note: Policies handled by Better Auth permissions directly
    // Note: API keys (tokens) managed by Better Auth API Key plugin
    // Note: Token revocation handled by Better Auth (deleteApiKey)
  };

  // Create vault instance for credential encryption
  const vault = new CredentialVault(config.encryption.key);

  // Return factory function
  return async (c: Context): Promise<MeshContext> => {
    // Authenticate request (OAuth session or API key)
    const authResult = await authenticateRequest(c, config.auth);

    // Build auth object for MeshContext
    const auth: MeshContext['auth'] = {
      user: authResult.user,
    };

    if (authResult.apiKeyId) {
      auth.apiKey = {
        id: authResult.apiKeyId,
        name: '', // Not needed for access control
        userId: '', // Not needed for access control
        permissions: authResult.permissions,
      };
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

    // Create AccessControl instance with unified permissions
    const access = new AccessControl(
      config.auth,
      auth.user?.id,
      undefined, // toolName set later by defineTool
      authResult.permissions, // Unified permissions from OAuth or API key
      authResult.role, // Role from OAuth session or undefined for API keys
      "mcp" // connectionId set when proxying
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

