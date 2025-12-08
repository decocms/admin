/**
 * Context Factory
 *
 * Creates MeshContext instances from HTTP requests (via Hono Context).
 * Handles:
 * - API key verification
 * - Organization scope extraction (from Better Auth)
 * - Storage adapter initialization
 * - Base URL derivation
 */

import type { Meter, Tracer } from "@opentelemetry/api";
import type { Context } from "hono";
import type { Kysely } from "kysely";
import { ConnectionStorage } from "../storage/connection";
import { AuditLogStorage } from "../storage/audit-log";
import { OrganizationSettingsStorage } from "../storage/organization-settings";
import type { Database } from "../storage/types";
import { AccessControl } from "./access-control";
import type { MeshContext, BetterAuthInstance } from "./mesh-context";
import { CredentialVault } from "../encryption/credential-vault";
import { verifyMeshToken } from "../auth/jwt";

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
 * Input: "openid profile email self:*"
 * Output: { "self": ["*"] }
 *
 * Input: "openid profile email self:PROJECT_CREATE self:CONNECTION_LIST"
 * Output: { "self": ["PROJECT_CREATE", "COLLECTION_CONNECTIONS_LIST"] }
 */
function scopesToPermissions(scopes: string): Record<string, string[]> {
  const permissions: Record<string, string[]> = {};

  // Split scopes and filter for self: prefixed ones
  const scopeList = scopes.split(" ").filter((s) => s.trim());

  for (const scope of scopeList) {
    const [connection, tool] = scope.split(":");
    if (connection && tool) {
      if (!permissions[connection]) {
        permissions[connection] = [];
      }
      permissions[connection].push(tool);
    }
  }

  return permissions;
}

interface OrganizationContext {
  id: string;
  slug: string;
  name: string;
}

interface AuthenticatedUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
}

/**
 * Fetch custom role permissions using Better Auth's internal adapter
 * This bypasses API permission checks which would create a circular dependency
 */
async function fetchCustomRolePermissions(
  auth: BetterAuthInstance,
  organizationId: string,
  roleName: string,
): Promise<Record<string, string[]>> {
  try {
    // Access Better Auth's internal context and adapter
    const context = await (auth as { $context: Promise<unknown> }).$context;
    const adapter = (
      context as {
        adapter?: { findOne: (params: unknown) => Promise<unknown> };
      }
    )?.adapter;

    if (!adapter?.findOne) {
      console.error("[Auth] Better Auth adapter not available");
      return {};
    }

    // Query the organizationRole table using Better Auth's adapter
    const roleRecord = (await adapter.findOne({
      model: "organizationRole",
      where: [
        {
          field: "organizationId",
          value: organizationId,
          operator: "eq",
          connector: "AND",
        },
        { field: "role", value: roleName, operator: "eq", connector: "AND" },
      ],
    })) as { permission?: string } | null;

    if (roleRecord?.permission) {
      return typeof roleRecord.permission === "string"
        ? JSON.parse(roleRecord.permission)
        : roleRecord.permission;
    }
  } catch (err) {
    console.error("[Auth] Failed to fetch custom role permissions:", err);
  }
  return {};
}

/**
 * Authenticate request using either OAuth session or API key
 * Returns unified authentication data with organization context
 */
async function authenticateRequest(
  c: Context,
  auth: BetterAuthInstance,
): Promise<{
  user?: AuthenticatedUser;
  permissions: Record<string, string[]>;
  role?: string;
  apiKeyId?: string;
  organization?: OrganizationContext;
}> {
  const authHeader = c.req.header("Authorization");

  // Try OAuth session first (getMcpSession)
  try {
    const session = (await auth.api.getMcpSession({
      headers: c.req.raw.headers,
    })) as OAuthSession | null;

    if (session) {
      // Parse OAuth scopes into permissions
      const scopes = session.scopes || "";
      const permissions = scopesToPermissions(scopes);

      // Load user from userId in session
      const userId = session.userId;

      // Get active organization from Better Auth organization plugin
      // The session might include organization context
      const orgData = await auth.api
        .getFullOrganization({
          headers: c.req.raw.headers,
        })
        .catch(() => null);

      return {
        user: { id: userId },
        permissions,
        organization: orgData
          ? {
              id: orgData.id,
              slug: orgData.slug,
              name: orgData.name,
            }
          : undefined,
      };
    }
  } catch (error) {
    const err = error as Error;
    console.error("[Auth] OAuth session check failed:", err);
  }

  // Try API Key or Mesh JWT authentication
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();

    // First, try to verify as Mesh JWT token
    // These are issued by mesh for downstream services calling back
    try {
      const meshJwtPayload = await verifyMeshToken(token);
      if (meshJwtPayload) {
        return {
          user: { id: meshJwtPayload.sub },
          permissions: meshJwtPayload.permissions || {},
        };
      }
    } catch {
      // Not a valid mesh JWT, continue to API key check
    }

    // Try API Key authentication
    try {
      const result = await auth.api.verifyApiKey({
        body: { key: token },
      });

      if (result?.valid && result.key) {
        // For API keys, organization might be embedded in metadata
        const orgMetadata = result.key.metadata?.organization as
          | OrganizationContext
          | undefined;

        return {
          permissions: result.key.permissions || {},
          apiKeyId: result.key.id,
          organization: orgMetadata
            ? {
                id: orgMetadata.id,
                slug: orgMetadata.slug,
                name: orgMetadata.name,
              }
            : undefined,
        };
      }
    } catch (error) {
      const err = error as Error;
      console.error("[Auth] API key check failed:", err);
    }
  }

  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (session) {
      let organization: OrganizationContext | undefined;
      let role: string | undefined;

      if (session.session.activeOrganizationId) {
        // Get full organization data (includes members with roles)
        const orgData = await auth.api
          .getFullOrganization({
            headers: c.req.raw.headers,
          })
          .catch(() => null);

        if (orgData) {
          organization = {
            id: orgData.id,
            slug: orgData.slug,
            name: orgData.name,
          };

          // Extract user's role from the members array
          // getFullOrganization returns members: [{ userId, role, ... }]
          const currentMember = orgData.members?.find(
            (m: { userId: string }) => m.userId === session.user.id,
          );
          role = currentMember?.role;
        } else {
          organization = {
            id: session.session.activeOrganizationId,
            slug: "",
            name: "",
          };
        }
      }

      // For custom roles (not built-in), fetch the role's permissions
      // using Better Auth's internal adapter (bypasses API permission checks)
      let permissions: Record<string, string[]> = {};
      const builtInRoles = ["owner", "admin", "member"];

      if (role && !builtInRoles.includes(role) && organization) {
        permissions = await fetchCustomRolePermissions(
          auth,
          organization.id,
          role,
        );
      }
      return {
        user: { id: session.user.id, email: session.user.email },
        permissions, // Custom role permissions or empty for built-in roles
        role, // Role name for built-in role bypass checks
        organization,
      };
    }
  } catch (error) {
    const err = error as Error;
    console.error("[Auth] Session check failed:", err);
  }

  // No valid authentication found - return empty auth data
  // Access control will check this and throw UnauthorizedError if needed
  return {
    user: undefined,
    permissions: {},
  };
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
  config: MeshContextConfig,
): (c: Context) => Promise<MeshContext> {
  // Create vault instance for credential encryption
  const vault = new CredentialVault(config.encryption.key);

  // Create storage adapters once (singleton pattern)
  const storage = {
    connections: new ConnectionStorage(config.db, vault),
    auditLogs: new AuditLogStorage(config.db),
    organizationSettings: new OrganizationSettingsStorage(config.db),
    // Note: Organizations, teams, members, roles managed by Better Auth organization plugin
    // Note: Policies handled by Better Auth permissions directly
    // Note: API keys (tokens) managed by Better Auth API Key plugin
    // Note: Token revocation handled by Better Auth (deleteApiKey)
  };

  // Return factory function
  return async (c: Context): Promise<MeshContext> => {
    // Authenticate request (OAuth session or API key)
    const authResult = await authenticateRequest(c, config.auth);

    // Build auth object for MeshContext
    const auth: MeshContext["auth"] = {
      user: authResult.user,
      permissions: authResult.permissions, // Unified permissions (API key or custom role)
    };

    if (authResult.apiKeyId) {
      auth.apiKey = {
        id: authResult.apiKeyId,
        name: "", // Not needed for access control
        userId: "", // Not needed for access control
        permissions: authResult.permissions,
      };
    }

    // Organization from Better Auth (OAuth session or API key metadata)
    const organization = authResult.organization;

    // Derive base URL from request
    const url = new URL(c.req.url);
    const baseUrl = process.env.BASE_URL ?? `${url.protocol}//${url.host}`;

    // Create AccessControl instance with unified permissions
    const access = new AccessControl(
      config.auth,
      auth.user?.id,
      undefined, // toolName set later by defineTool
      authResult.permissions, // Unified permissions from OAuth or API key
      authResult.role, // Role from OAuth session or undefined for API keys
      "self", // Default connectionId for management APIs
    );

    return {
      auth,
      organization,
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
        userAgent: c.req.header("User-Agent"),
        ipAddress:
          c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For"),
      },
    };
  };
}
