/**
 * Better Auth Configuration for MCP Mesh
 * 
 * Provides:
 * - MCP OAuth 2.1 server (via MCP plugin)
 * - API Key management (via API Key plugin)
 * - Role-based access control (via Admin plugin)
 * 
 * Configuration is file-based (auth-config.json), not environment variables.
 */

import { betterAuth, BetterAuthOptions } from 'better-auth';
import { admin, apiKey, mcp, openAPI } from 'better-auth/plugins';
import { existsSync, readFileSync } from 'fs';
import { BunWorkerDialect } from 'kysely-bun-worker';

/**
 * Load optional auth configuration from file
 */
function loadAuthConfig(): Partial<BetterAuthOptions> {
  const configPath = './auth-config.json';

  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to load auth-config.json:', error);
      return {};
    }
  }

  return {};
}

/**
 * Get database URL from environment or default
 */
function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || './data/mesh.db';
}

/**
 * Better Auth instance with MCP, API Key, and Admin plugins
 */
export const auth = betterAuth({
  // Better Auth can use BunWorkerDialect directly
  database: new BunWorkerDialect({
    url: getDatabaseUrl(),
  }),

  emailAndPassword: {
    enabled: true,
  },

  // Load optional configuration from file
  ...loadAuthConfig(),

  plugins: [
    // MCP plugin for OAuth 2.1 server
    // https://www.better-auth.com/docs/plugins/mcp
    mcp({
      loginPage: '/sign-in',
      resource: process.env.MCP_RESOURCE_URL || 'http://localhost:3000',
    }),

    // API Key plugin for direct tool access
    // https://www.better-auth.com/docs/plugins/api-key
    apiKey({
      permissions: {
        defaultPermissions: {
          'mcp': ['PROJECT_LIST', 'PROJECT_GET'], // Default org-level tools
        },
      },
    }),

    // Admin plugin for role-based access
    // https://www.better-auth.com/docs/plugins/admin
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),

    // OpenAPI plugin for API documentation
    // https://www.better-auth.com/docs/plugins/openAPI
    openAPI(),
  ],
});

export type BetterAuthInstance = typeof auth;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to create API key
 */
export async function createApiKey(params: {
  userId: string;
  name: string;
  permissions: Record<string, string[]>;
  expiresIn?: number;
}) {
  return await auth.api.createApiKey({
    body: {
      userId: params.userId,
      name: params.name,
      permissions: params.permissions,
      expiresIn: params.expiresIn,
    },
  });
}

/**
 * Helper to verify API key
 */
export async function verifyApiKey(key: string) {
  return await auth.api.verifyApiKey({
    body: { key },
  });
}

/**
 * Helper to check user permission
 * Note: Either provide `permission` (to check) OR `permissions` (from API key), not both
 */
export async function checkPermission(params: {
  userId: string;
  role?: 'user' | 'admin';
  permission: Record<string, string[]>;
}) {
  return await auth.api.userHasPermission({
    body: {
      userId: params.userId,
      role: params.role,
      permission: params.permission,
    },
  });
}

