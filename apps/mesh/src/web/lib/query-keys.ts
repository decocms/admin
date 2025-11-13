/**
 * Centralized Query Keys for React Query
 *
 * This ensures consistent cache key management across the application
 * and prevents inline array declarations that are harder to maintain.
 */

export const KEYS = {
  // Auth-related queries
  authConfig: () => ["authConfig"] as const,

  // Organization members (scoped by org)
  members: (orgId: string) => ["members", orgId] as const,

  // Connections (scoped by org)
  connections: (orgId: string) => ["connections", orgId] as const,
  connection: (id: string) => ["connection", id] as const,
} as const;
