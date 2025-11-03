/**
 * MeshContext - Core abstraction for all tools
 *
 * Provides tools with access to all necessary services without coupling them
 * to HTTP frameworks or database drivers.
 *
 * Key Principles:
 * - Tools NEVER access HTTP objects directly
 * - Tools NEVER access database drivers directly
 * - Tools NEVER access environment variables directly
 * - All dependencies injected through this interface
 */

import type { Meter, Tracer } from "@opentelemetry/api";
import type { Kysely } from "kysely";
import type { CredentialVault } from "../encryption/credential-vault";
import type { Database, Permission } from "../storage/types";
import type { AccessControl } from "./access-control";
export type { BetterAuthInstance } from "@/auth";
// Re-export for consumers
export type { AccessControl, CredentialVault };

// ============================================================================
// Authentication State
// ============================================================================

/**
 * Authentication state from Better Auth
 */
export interface MeshAuth {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string; // From Better Auth Admin plugin
  };

  apiKey?: {
    id: string;
    name: string;
    userId: string;
    permissions: Permission; // Better Auth permission model
    metadata?: Record<string, any>;
    remaining?: number; // Remaining requests (rate limiting)
    expiresAt?: Date;
  };
}

// ============================================================================
// Organization Scope
// ============================================================================

/**
 * Organization scope
 * Organization context from Better Auth organization plugin
 */
export interface OrganizationScope {
  id: string;
  slug: string;
  name: string;
}

// ============================================================================
// Request Metadata
// ============================================================================

/**
 * Request metadata (non-HTTP specific)
 */
export interface RequestMetadata {
  requestId: string;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
}

// ============================================================================
// Storage Interfaces
// ============================================================================

// Forward declare storage types
import { BetterAuthInstance } from "@/auth";
import type { AuditLogStorage } from "../storage/audit-log";
import type { ConnectionStorage } from "../storage/connection";

// Better Auth instance type - flexible for testing
// In production, this is the actual Better Auth instance
// In tests, can be a partial mock

/**
 * Storage interfaces aggregation
 *
 * Note:
 * - Organizations, teams, members, and roles managed by Better Auth organization plugin
 * - Policies handled by Better Auth permissions directly
 * - API Keys (tokens) managed by Better Auth API Key plugin
 * - Token revocation handled by Better Auth (deleteApiKey)
 */
export interface MeshStorage {
  connections: ConnectionStorage;
  auditLogs: AuditLogStorage;
}

// ============================================================================
// MeshContext Interface
// ============================================================================

/**
 * MeshContext - The core abstraction passed to every tool handler
 *
 * This provides access to all necessary services without coupling
 * to implementation details.
 */
export interface MeshContext {
  // Authentication (via Better Auth)
  auth: MeshAuth;

  // Organization scope (from Better Auth organization plugin)
  organization?: OrganizationScope;

  // Storage interfaces (database-agnostic)
  storage: MeshStorage;

  // Security services
  vault: CredentialVault; // For encrypting connection credentials
  authInstance: BetterAuthInstance; // Better Auth instance

  // Access control (for authorization)
  access: AccessControl;

  // Database (Kysely instance for direct queries when needed)
  db: Kysely<Database>;

  // Current tool being executed (set by defineTool wrapper)
  toolName?: string;

  // Observability (OpenTelemetry)
  tracer: Tracer;
  meter: Meter;

  // Base URL (derived from request, for OAuth callbacks, etc.)
  baseUrl: string;

  // Request metadata (non-HTTP specific)
  metadata: RequestMetadata;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if context has organization scope
 */
export function hasOrganization(ctx: MeshContext): boolean {
  return ctx.organization !== undefined;
}

/**
 * Get organization ID or null
 */
export function getOrganizationId(ctx: MeshContext): string | null {
  return ctx.organization?.id ?? null;
}

/**
 * Require organization scope (throws if not organization-scoped)
 */
export function requireOrganization(ctx: MeshContext): OrganizationScope {
  if (!ctx.organization) {
    throw new Error("This operation requires organization scope");
  }
  return ctx.organization;
}

/**
 * Get user ID (from user or API key)
 */
export function getUserId(ctx: MeshContext): string | undefined {
  return ctx.auth.user?.id ?? ctx.auth.apiKey?.userId;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(ctx: MeshContext): boolean {
  return !!(ctx.auth.user || ctx.auth.apiKey);
}

/**
 * Require authentication (throws if not authenticated)
 */
export function requireAuth(ctx: MeshContext): void {
  if (!isAuthenticated(ctx)) {
    throw new Error("Authentication required");
  }
}
