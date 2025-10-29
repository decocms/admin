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

import type { Meter, Tracer } from '@opentelemetry/api';
import type { Kysely } from 'kysely';
import type { CredentialVault } from '../encryption/credential-vault';
import type { Database, Permission } from '../storage/types';
import type { AccessControl } from './access-control';

// Re-export for consumers
export type { AccessControl, CredentialVault };

// Forward declaration for Better Auth (will be replaced when implemented)
export type BetterAuthInstance = any;

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
// Project Scope
// ============================================================================

/**
 * Project scope (namespace-level)
 * If undefined, context is organization-scoped (cluster-level)
 */
export interface ProjectScope {
  id: string;
  slug: string;
  ownerId: string;
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
import type { AuditLogStorage } from '../storage/audit-log';
import type { ConnectionStorage } from '../storage/connection';
import type { ProjectStorage } from '../storage/project';
import type { RoleStorage } from '../storage/role';

/**
 * Storage interfaces aggregation
 * 
 * Note: 
 * - Policies handled by Better Auth permissions directly
 * - API Keys (tokens) managed by Better Auth API Key plugin
 * - Token revocation handled by Better Auth (deleteApiKey)
 */
export interface MeshStorage {
  projects: ProjectStorage;
  connections: ConnectionStorage;
  auditLogs: AuditLogStorage;
  roles: RoleStorage;
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

  // Project scope (undefined = organization-scoped, defined = project-scoped)
  project?: ProjectScope;

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
 * Check if context is project-scoped
 */
export function isProjectScoped(ctx: MeshContext): boolean {
  return ctx.project !== undefined;
}

/**
 * Check if context is organization-scoped
 */
export function isOrganizationScoped(ctx: MeshContext): boolean {
  return ctx.project === undefined;
}

/**
 * Get project ID or null
 */
export function getProjectId(ctx: MeshContext): string | null {
  return ctx.project?.id ?? null;
}

/**
 * Require project scope (throws if not project-scoped)
 */
export function requireProjectScope(ctx: MeshContext): ProjectScope {
  if (!ctx.project) {
    throw new Error('This operation requires project scope');
  }
  return ctx.project;
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
    throw new Error('Authentication required');
  }
}

