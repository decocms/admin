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
import type {
  MeshContext,
  BetterAuthInstance,
  BoundAuthClient,
} from "./mesh-context";
import { CredentialVault } from "../encryption/credential-vault";
import { verifyMeshToken } from "../auth/jwt";
import type { Permission } from "../storage/types";

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

// Type for the hasPermission API (from @decocms/better-auth organization plugin)
type HasPermissionAPI = (params: {
  headers: Headers;
  body: { permission: Permission };
}) => Promise<{ success?: boolean; error?: unknown } | null>;

/**
 * Create a bound auth client that encapsulates HTTP headers
 * MeshContext stays HTTP-agnostic while delegating permission checks to Better Auth
 */
function createBoundAuthClient(
  auth: BetterAuthInstance,
  headers: Headers,
): BoundAuthClient {
  // Get hasPermission from Better Auth's organization plugin
  const hasPermissionApi = (auth.api as { hasPermission?: HasPermissionAPI })
    .hasPermission;

  return {
    hasPermission: async (permission: Permission): Promise<boolean> => {
      if (!hasPermissionApi) {
        console.error("[Auth] hasPermission API not available");
        return false;
      }

      try {
        // Check exact permission first: { resource: [tool] }
        const exactResult = await hasPermissionApi({
          headers,
          body: { permission },
        });

        if (exactResult?.success === true) {
          return true;
        }

        // Check wildcard permission: { resource: ["*"] }
        // Better Auth may not handle wildcards, so we check explicitly
        const wildcardPermission: Permission = {};
        for (const resource of Object.keys(permission)) {
          wildcardPermission[resource] = ["*"];
        }

        const wildcardResult = await hasPermissionApi({
          headers,
          body: { permission: wildcardPermission },
        });

        return wildcardResult?.success === true;
      } catch (err) {
        console.error("[Auth] Permission check failed:", err);
        return false;
      }
    },
  };
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
      // Load user from userId in session
      const userId = session.userId;

      // Get active organization from Better Auth organization plugin
      const orgData = await auth.api
        .getFullOrganization({
          headers: c.req.raw.headers,
        })
        .catch(() => null);

      // Extract user's role from the members array
      let role: string | undefined;
      if (orgData) {
        const currentMember = orgData.members?.find(
          (m: { userId: string }) => m.userId === userId,
        );
        role = currentMember?.role;
      }

      return {
        user: { id: userId, role },
        role,
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

      return {
        user: { id: session.user.id, email: session.user.email, role },
        role,
        organization,
      };
    }
  } catch (error) {
    const err = error as Error;
    console.error("[Auth] Session check failed:", err);
  }

  // No valid authentication found - return empty auth data
  return {
    user: undefined,
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

    // Create bound auth client (encapsulates HTTP headers for permission checks)
    const boundAuth = createBoundAuthClient(config.auth, c.req.raw.headers);

    // Build auth object for MeshContext
    const auth: MeshContext["auth"] = {
      user: authResult.user,
    };

    if (authResult.apiKeyId) {
      auth.apiKey = {
        id: authResult.apiKeyId,
        name: "", // Not needed for access control
        userId: "", // Not needed for access control
      };
    }

    // Organization from Better Auth (OAuth session or API key metadata)
    const organization = authResult.organization;

    // Derive base URL from request
    const url = new URL(c.req.url);
    const baseUrl = process.env.BASE_URL ?? `${url.protocol}//${url.host}`;

    // Create AccessControl instance with bound auth client
    const access = new AccessControl(
      config.auth,
      auth.user?.id,
      undefined, // toolName set later by defineTool
      boundAuth, // Bound auth client for permission checks
      authResult.role, // Role from session (for built-in role bypass)
      "self", // Default connectionId for management APIs
    );

    return {
      auth,
      organization,
      storage,
      vault,
      authInstance: config.auth,
      boundAuth, // Pre-bound auth client for permission checks
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
