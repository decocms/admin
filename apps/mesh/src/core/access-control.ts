/**
 * Access Control for MCP Mesh
 *
 * Uses Better Auth's permission system for authorization.
 * Follows a grant-based model:
 * 1. Tools call ctx.access.check() to verify permissions
 * 2. If allowed, access is granted internally
 * 3. Middleware verifies that access was granted
 * 4. Tools can manually grant access for custom logic
 */

import type { Permission } from "../storage/types";
import { BetterAuthInstance } from "./mesh-context";

// Forward declaration (will be replaced with actual Better Auth type)

// ============================================================================
// Errors
// ============================================================================

/**
 * Custom error for unauthenticated requests (401)
 */
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Custom error for access denial (403)
 */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

// ============================================================================
// AccessControl Class
// ============================================================================

/**
 * AccessControl using Better Auth's permission system
 *
 * Works with both:
 * - Admin plugin (role-based permissions)
 * - API Key plugin (key-based permissions)
 */
export class AccessControl implements Disposable {
  private _granted: boolean = false;

  constructor(
    private auth: BetterAuthInstance,
    private userId?: string,
    private toolName?: string,
    private permissions?: Permission, // From API key
    private role?: string, // From user session
    private connectionId: string = "self", // For connection-specific checks
  ) {}

  [Symbol.dispose](): void {
    this._granted = false;
  }

  setToolName(toolName: string): void {
    this.toolName = toolName;
  }

  /**
   * Grant access unconditionally
   * Use for manual overrides, admin actions, or custom validation
   */
  grant(): Disposable {
    this._granted = true;
    return {
      [Symbol.dispose]: () => {
        this._granted = false;
      },
    };
  }

  /**
   * Check permissions and grant access if allowed
   *
   * @param resources - Resources to check (OR logic)
   * If omitted, checks the current tool name
   *
   * @throws UnauthorizedError if not authenticated (401)
   * @throws ForbiddenError if access is denied (403)
   *
   * @example
   * await ctx.access.check(); // Check current tool
   * await ctx.access.check('conn_<UUID>'); // Check connection access
   * await ctx.access.check('TOOL1', 'TOOL2'); // Check TOOL1 OR TOOL2
   */
  async check(...resources: string[]): Promise<void> {
    // If already granted, skip check
    if (this._granted) {
      return;
    }

    // Check if authenticated first (401)
    if (
      !this.userId &&
      (!this.permissions || Object.keys(this.permissions).length === 0)
    ) {
      throw new UnauthorizedError(
        "Authentication required. Please provide a valid OAuth token or API key.",
      );
    }

    // Determine what to check
    const resourcesToCheck =
      resources.length > 0 ? resources : this.toolName ? [this.toolName] : [];

    if (resourcesToCheck.length === 0) {
      throw new ForbiddenError("No resources specified for access check");
    }

    // Try each resource - if ANY succeeds, grant access (OR logic)
    for (const resource of resourcesToCheck) {
      const hasAccess = await this.checkResource(resource);
      if (hasAccess) {
        this.grant();
        return;
      }
    }

    // No permission found
    throw new ForbiddenError(
      `Access denied to: ${resourcesToCheck.join(", ")}`,
    );
  }

  /**
   * Check if user has permission to access a resource
   */
  private async checkResource(resource: string): Promise<boolean> {
    // No user or permissions = deny
    if (!this.userId && !this.permissions) {
      return false;
    }

    // Admin and owner roles bypass all checks (they have full access)
    if (this.role === "admin" || this.role === "owner") {
      return true;
    }

    // Build permission check
    const permissionToCheck: Permission = {};

    // If checking a specific connection, also check that
    if (this.connectionId) {
      permissionToCheck[this.connectionId] = [resource];
    }

    try {
      // Use Better Auth's permission checking if available
      if (this.userId && this.auth?.api?.userHasPermission) {
        const result = await this.auth.api.userHasPermission({
          body: {
            userId: this.userId,
            role: this.role as "user" | "admin" | undefined,
            permission: permissionToCheck,
          },
        });

        // Better Auth can return { data: { has: boolean } } or just { success: boolean }
        // If it returns a valid result, use it; otherwise fall back to manual
        if (result) {
          // Type guard for Better Auth permission check result
          const resultObj = result as {
            data?: { has?: boolean };
            success?: boolean;
          };
          const hasPermission =
            resultObj.data?.has === true || resultObj.success === true;
          if (hasPermission) {
            return true;
          }
        }
      }

      // Fallback to manual check (when no Better Auth or permission denied)
      return this.manualPermissionCheck(resource);
    } catch {
      // Fallback to manual check on error
      return this.manualPermissionCheck(resource);
    }
  }

  /**
   * Fallback manual permission check
   * Used when Better Auth API is unavailable or for API key-only auth
   */
  private manualPermissionCheck(resource: string): boolean {
    if (!this.permissions || Object.keys(this.permissions).length === 0) {
      return false;
    }

    // Check permissions object
    for (const [key, actions] of Object.entries(this.permissions)) {
      const matchesConnection = !this.connectionId || key === this.connectionId;

      if (!matchesConnection) {
        continue;
      }

      // Check if resource matches the permission key (e.g., checking 'conn_123' access)
      if (key === resource && actions.length > 0) {
        return true;
      }

      // Check if resource is in actions array or has wildcard
      if (actions.includes(resource) || actions.includes("*")) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if access was granted
   */
  granted(): boolean {
    return this._granted;
  }
}
