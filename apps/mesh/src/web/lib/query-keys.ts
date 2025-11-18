/**
 * Centralized Query Keys for React Query
 *
 * This ensures consistent cache key management across the application
 * and prevents inline array declarations that are harder to maintain.
 */

import { ProjectLocator } from "./locator";

export const KEYS = {
  // Auth-related queries
  authConfig: () => ["authConfig"] as const,

  // Organization members (scoped by org)
  members: (locator: ProjectLocator) => [locator, "members"] as const,

  // Connections (scoped by project)
  connections: (locator: ProjectLocator) => [locator, "connections"] as const,
  connectionsByBinding: (locator: ProjectLocator, binding: string) =>
    [locator, "connections", `binding:${binding}`] as const,
  connection: (locator: ProjectLocator, id: string) =>
    [locator, "connection", id] as const,

  organizationSettings: (organizationId: string) =>
    ["organization-settings", organizationId] as const,

  // Sidebar items (scoped by project)
  sidebarItems: (locator: ProjectLocator) =>
    [locator, "sidebar-items"] as const,
} as const;
