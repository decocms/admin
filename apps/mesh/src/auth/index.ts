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

import { getToolsByCategory } from "@/tools/registry";
import { betterAuth, BetterAuthOptions } from "better-auth";
import {
  admin as adminPlugin,
  apiKey,
  mcp,
  openAPI,
  organization,
} from "better-auth/plugins";
import type { BetterAuthPlugin } from "better-auth";
import { sso } from "@better-auth/sso";
import { existsSync, readFileSync } from "fs";
import { BunWorkerDialect } from "kysely-bun-worker";
import { createAccessControl } from "better-auth/plugins/access";
import { createSSOConfig, SSOConfig } from "./sso";
import path from "path";

/**
 * Load optional auth configuration from file
 */
function loadAuthConfig(): Partial<BetterAuthOptions> {
  const configPath = "./auth-config.json";

  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  return {};
}

/**
 * Get database URL from environment or default
 */
export function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    `file://${path.join(process.cwd(), "data/mesh.db")}`
  );
}

const statement = {} as const;

const ac = createAccessControl(statement);

const user = ac.newRole({
  self: ["*"],
});

const admin = ac.newRole({
  self: ["*"],
});

const scopes = Object.values(getToolsByCategory())
  .map((tool) => tool.map((t) => `self:${t.name}`))
  .flat();

export const authConfig: Partial<BetterAuthOptions> & {
  ssoConfig?: SSOConfig;
} = loadAuthConfig();

const plugins = [
  // Organization plugin for multi-tenant organization management
  // https://www.better-auth.com/docs/plugins/organization
  organization({
    ac,
    allowUserToCreateOrganization: true, // Users can create organizations by default
    dynamicAccessControl: {
      enabled: true,
      maximumRolesPerOrganization: 500,
    },
    roles: {
      user,
      admin,
    },
  }),

  // MCP plugin for OAuth 2.1 server
  // https://www.better-auth.com/docs/plugins/mcp
  mcp({
    loginPage: "/auth/sign-in",
    // Note: Authorization page (/authorize) is served as static HTML
    // Better Auth will redirect there based on loginPage flow
    oidcConfig: {
      scopes: scopes,
      metadata: { scopes_supported: scopes },
      loginPage: "/auth/sign-in",
    },
  }),

  // API Key plugin for direct tool access
  // https://www.better-auth.com/docs/plugins/api-key
  apiKey({
    permissions: {
      defaultPermissions: {
        self: [
          "ORGANIZATION_LIST",
          "ORGANIZATION_GET", // Organization read access
          "ORGANIZATION_MEMBER_LIST", // Member read access
          "CONNECTION_LIST",
          "CONNECTION_GET", // Connection read access
        ],
      },
    },
  }),

  // Admin plugin for system-level super-admins
  // https://www.better-auth.com/docs/plugins/admin
  adminPlugin({
    defaultRole: "user",
    adminRoles: ["admin"],
  }),

  // OpenAPI plugin for API documentation
  // https://www.better-auth.com/docs/plugins/openAPI
  openAPI(),

  sso(authConfig.ssoConfig ? createSSOConfig(authConfig.ssoConfig) : undefined),
];

/**
 * Better Auth instance with MCP, API Key, and Admin plugins
 */
export const auth = betterAuth({
  // Base URL for OAuth - will be overridden by request context
  baseURL: process.env.BASE_URL || "http://localhost:3000",

  // Better Auth can use BunWorkerDialect directly
  database: new BunWorkerDialect({
    url: getDatabaseUrl(),
  }),

  emailAndPassword: {
    enabled: true,
  },

  // Load optional configuration from file
  ...authConfig,

  plugins,
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
  role?: "user" | "admin";
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
