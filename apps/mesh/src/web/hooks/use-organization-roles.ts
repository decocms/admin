/**
 * Organization Roles Hook
 *
 * Provides React hooks for working with organization roles using Better Auth's
 * dynamic access control feature. Combines built-in roles with custom roles.
 */

import { authClient } from "@/web/lib/auth-client";
import { KEYS } from "@/web/lib/query-keys";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { useQuery } from "@tanstack/react-query";

/**
 * Built-in roles that are always available
 */
const BUILTIN_ROLES = [
  { value: "owner", label: "Owner", isBuiltin: true },
  { value: "admin", label: "Admin", isBuiltin: true },
  { value: "member", label: "Member", isBuiltin: true },
] as const;

export interface OrganizationRole {
  id?: string;
  role: string;
  label: string;
  isBuiltin: boolean;
  permission?: Record<string, string[]>;
  // Static/organization-level permissions (under "self")
  staticPermissionCount?: number;
  allowsAllStaticPermissions?: boolean;
  // Connection-specific permissions
  connectionCount?: number;
  toolCount?: number;
  allowsAllConnections?: boolean;
  allowsAllTools?: boolean;
}

/**
 * Parse permission to extract static and connection-specific information
 * Format: { "self": ["PERM1", "PERM2"], "<connectionId>": ["tool1", "tool2"], "*": ["*"] }
 */
function parsePermission(permission: Record<string, string[]> | undefined): {
  // Static permissions (under "self")
  staticPermissions: string[];
  allowsAllStaticPermissions: boolean;
  // Connection permissions
  connectionIds: string[];
  allowsAllConnections: boolean;
  toolNames: string[];
  allowsAllTools: boolean;
} {
  if (!permission) {
    return {
      staticPermissions: [],
      allowsAllStaticPermissions: false,
      connectionIds: [],
      allowsAllConnections: false,
      toolNames: [],
      allowsAllTools: false,
    };
  }

  const staticPermissions: string[] = [];
  let allowsAllStaticPermissions = false;
  const connectionIds: string[] = [];
  let allowsAllConnections = false;
  const toolNamesSet = new Set<string>();
  let allowsAllTools = false;

  for (const [resource, tools] of Object.entries(permission)) {
    // "self" is for static/organization-level permissions
    if (resource === "self") {
      if (tools.includes("*")) {
        allowsAllStaticPermissions = true;
      } else {
        staticPermissions.push(...tools);
      }
      continue;
    }

    // "*" is for all connections
    if (resource === "*") {
      allowsAllConnections = true;
      // Check tools for this wildcard
      if (tools.includes("*")) {
        allowsAllTools = true;
      } else {
        for (const tool of tools) {
          toolNamesSet.add(tool);
        }
      }
      continue;
    }

    // Otherwise it's a connection ID
    connectionIds.push(resource);

    // Check tools
    if (tools.includes("*")) {
      allowsAllTools = true;
    } else {
      for (const tool of tools) {
        toolNamesSet.add(tool);
      }
    }
  }

  return {
    staticPermissions,
    allowsAllStaticPermissions,
    connectionIds,
    allowsAllConnections,
    toolNames: Array.from(toolNamesSet),
    allowsAllTools,
  };
}

/**
 * Hook to get all organization roles (built-in + custom)
 *
 * @returns List of roles available for the organization
 */
export function useOrganizationRoles() {
  const { locator } = useProjectContext();

  const {
    data: customRolesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: KEYS.organizationRoles(locator),
    queryFn: async () => {
      try {
        // Fetch custom roles from Better Auth
        // The API returns the roles array directly (not wrapped in { roles: [...] })
        if (!("listRoles" in authClient.organization)) {
          return [];
        }
        const listRoles = authClient.organization.listRoles as () => Promise<{
          data: OrganizationRole[];
          error: Error | null;
        }>;
        const result = await listRoles();

        if (result.error) {
          console.error("Failed to fetch roles:", result.error);
          return [];
        }

        // result.data IS the roles array directly
        return result.data ?? [];
      } catch (err) {
        console.error("Error fetching organization roles:", err);
        return [];
      }
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  // Combine built-in roles with custom roles
  const allRoles: OrganizationRole[] = BUILTIN_ROLES.map((r) => ({
    role: r.value,
    label: r.label,
    isBuiltin: r.isBuiltin,
  }));

  // Add custom roles
  if (customRolesData && Array.isArray(customRolesData)) {
    for (const customRole of customRolesData) {
      // Skip if it's a built-in role name
      if (BUILTIN_ROLES.some((b) => b.value === customRole.role)) {
        continue;
      }

      const {
        staticPermissions,
        allowsAllStaticPermissions,
        connectionIds,
        allowsAllConnections,
        toolNames,
        allowsAllTools,
      } = parsePermission(customRole.permission);

      allRoles.push({
        id: customRole.id,
        role: customRole.role,
        label: formatRoleLabel(customRole.role),
        isBuiltin: false,
        permission: customRole.permission,
        // Static permissions
        staticPermissionCount: allowsAllStaticPermissions
          ? -1
          : staticPermissions.length,
        allowsAllStaticPermissions,
        // Connection permissions
        connectionCount: allowsAllConnections ? -1 : connectionIds.length,
        allowsAllConnections,
        toolCount: allowsAllTools ? -1 : toolNames.length,
        allowsAllTools,
      });
    }
  }

  return {
    roles: allRoles,
    customRoles: allRoles.filter((r) => !r.isBuiltin),
    builtinRoles: allRoles.filter((r) => r.isBuiltin),
    isLoading,
    error,
    refetch,
  };
}

/**
 * Format a role name into a human-readable label
 */
function formatRoleLabel(role: string): string {
  return role
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
