/**
 * Database Types for MCP Mesh
 *
 * These TypeScript interfaces define the database schema using Kysely's type-only approach.
 * The dialect (SQLite, PostgreSQL, MySQL) is determined at runtime from DATABASE_URL.
 *
 * Key Principles:
 * - Database = Organization boundary (all users are org members)
 * - Organizations managed by Better Auth organization plugin
 * - Connections are organization-scoped
 * - Access control via Better Auth permissions and organization roles
 */

import type { ColumnType } from "kysely";
import type { OAuthConfig, ToolDefinition } from "../tools/connection/schema";

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Helper for JSON columns that store arrays
 * Kysely maps JSON to string in database, but T[] in TypeScript
 */
export type JsonArray<T> = ColumnType<T[], string, string>;

/**
 * Helper for JSON columns that store objects
 * Kysely maps JSON to string in database, but T in TypeScript
 */
export type JsonObject<T> = ColumnType<T, string, string>;

// ============================================================================
// Permission Type (Better Auth format)
// ============================================================================

/**
 * Permission format used by Better Auth
 * Format: { [resource]: [actions...] }
 *
 * Examples:
 * - Organization-level: { "self": ["PROJECT_CREATE", "PROJECT_LIST"] }
 * - Connection-specific: { "conn_<UUID>": ["SEND_MESSAGE", "LIST_THREADS"] }
 */
export type Permission = Record<string, string[]>;

// ============================================================================
// Core Entity Interfaces
// ============================================================================

// ============================================================================
// Database Table Definitions (for Kysely schema)
// ============================================================================

/**
 * User table definition - System users
 * Managed by Better Auth, but defined here for reference
 */
export interface UserTable {
  id: string;
  email: string;
  name: string;
  role: string; // System role: 'admin' | 'user'
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}

// ============================================================================
// Runtime Entity Types (for application code)
// ============================================================================

/**
 * User entity - Runtime representation
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Organization entity - Runtime representation (from Better Auth)
 * Better Auth organization plugin provides this data
 */
export interface Organization {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | string;
}

export interface OrganizationSettingsTable {
  organizationId: string;
  modelsBindingConnectionId: ColumnType<
    string | null,
    string | null,
    string | null
  >;
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}

export interface OrganizationSettings {
  organizationId: string;
  modelsBindingConnectionId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * MCP Connection table definition
 * Uses snake_case column names to align with ConnectionEntitySchema
 */
export interface MCPConnectionTable {
  id: string;
  organization_id: string; // All connections are organization-scoped
  created_by: string; // User who created this connection
  title: string;
  description: string | null;
  icon: string | null;
  app_name: string | null;
  app_id: string | null;

  // Connection details
  connection_type: "HTTP" | "SSE" | "Websocket";
  connection_url: string;
  connection_token: string | null; // Encrypted
  connection_headers: JsonObject<Record<string, string>> | null;

  // OAuth config for downstream MCP (if MCP supports OAuth)
  oauth_config: JsonObject<OAuthConfig> | null;

  // Metadata and discovery
  metadata: JsonObject<Record<string, unknown>> | null;
  tools: JsonArray<ToolDefinition[]> | null; // Discovered tools from MCP
  bindings: JsonArray<string[]> | null; // Detected bindings (CHAT, EMAIL, etc.)

  status: "active" | "inactive" | "error";
  created_at: ColumnType<Date, Date | string, never>;
  updated_at: ColumnType<Date, Date | string, Date | string>;
}

// MCPConnection runtime type is now ConnectionEntity from "../tools/connection/schema"
// OAuthConfig and ToolDefinition are also exported from schema.ts

/**
 * API Key table definition
 */
export interface ApiKeyTable {
  id: string;
  userId: string; // Owner of this API key
  name: string;
  hashedKey: string; // Hashed API key (Better Auth handles this)
  permissions: JsonObject<Permission>; // { [resource]: [actions...] }
  expiresAt: ColumnType<Date, Date | string, never> | null;
  remaining: number | null; // Request quota
  metadata: JsonObject<Record<string, unknown>> | null;
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}

/**
 * Audit Log table definition
 */
export interface AuditLogTable {
  id: string;
  organizationId: string | null; // null = system-level action
  userId: string | null;
  connectionId: string | null;
  toolName: string; // Tool that was called
  allowed: number; // SQLite boolean (0 or 1)
  duration: number | null; // Execution time in ms
  timestamp: ColumnType<Date, Date | string, never>;
  requestMetadata: JsonObject<Record<string, unknown>> | null;
}

/**
 * API Key entity - Runtime representation
 */
export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  hashedKey: string;
  permissions: Permission;
  expiresAt: Date | string | null;
  remaining: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Audit Log entity - Runtime representation
 */
export interface AuditLog {
  id: string;
  organizationId: string | null;
  userId: string | null;
  connectionId: string | null;
  toolName: string;
  allowed: boolean;
  duration: number | null;
  timestamp: Date | string;
  requestMetadata: Record<string, unknown> | null;
}

// ============================================================================
// OAuth Table Definitions (for MCP OAuth server)
// ============================================================================

/**
 * OAuth Client table definition (RFC 7591 - Dynamic Client Registration)
 */
export interface OAuthClientTable {
  id: string;
  clientId: string; // Unique
  clientSecret: string | null; // Hashed, null for public clients
  clientName: string;
  redirectUris: JsonArray<string[]>; // JSON array
  grantTypes: JsonArray<string[]>; // JSON array
  scope: string | null;
  clientUri: string | null;
  logoUri: string | null;
  createdAt: ColumnType<Date, Date | string, never>;
}

/**
 * OAuth Authorization Code table definition (PKCE support)
 */
export interface OAuthAuthorizationCodeTable {
  code: string; // Primary key
  clientId: string; // Foreign key
  userId: string;
  redirectUri: string;
  scope: string | null;
  codeChallenge: string | null; // PKCE
  codeChallengeMethod: string | null; // 'S256'
  expiresAt: ColumnType<Date, Date | string, never>;
  createdAt: ColumnType<Date, Date | string, never>;
}

/**
 * OAuth Refresh Token table definition
 */
export interface OAuthRefreshTokenTable {
  token: string; // Primary key
  clientId: string; // Foreign key
  userId: string;
  scope: string | null;
  expiresAt: ColumnType<Date, Date | string, never> | null;
  createdAt: ColumnType<Date, Date | string, never>;
}

/**
 * Downstream Token table definition - Cache tokens from downstream MCPs
 */
export interface DownstreamTokenTable {
  id: string; // Primary key
  connectionId: string; // Foreign key
  userId: string | null; // Null for client_credentials tokens
  accessToken: string; // Encrypted
  refreshToken: string | null; // Encrypted
  scope: string | null;
  expiresAt: ColumnType<Date, Date | string, never> | null;
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}

// ============================================================================
// OAuth Runtime Entity Types
// ============================================================================

/**
 * OAuth Client entity - Runtime representation
 */
export interface OAuthClient {
  id: string;
  clientId: string;
  clientSecret: string | null;
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  scope: string | null;
  clientUri: string | null;
  logoUri: string | null;
  createdAt: Date | string;
}

/**
 * OAuth Authorization Code entity - Runtime representation
 */
export interface OAuthAuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  expiresAt: Date | string;
  createdAt: Date | string;
}

/**
 * OAuth Refresh Token entity - Runtime representation
 */
export interface OAuthRefreshToken {
  token: string;
  clientId: string;
  userId: string;
  scope: string | null;
  expiresAt: Date | string | null;
  createdAt: Date | string;
}

/**
 * Downstream Token entity - Runtime representation
 */
export interface DownstreamToken {
  id: string;
  connectionId: string;
  userId: string | null;
  accessToken: string;
  refreshToken: string | null;
  scope: string | null;
  expiresAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================================
// Database Schema
// ============================================================================

/**
 * Complete database schema
 * All tables exist within the organization scope (database boundary)
 *
 * NOTE: This uses *Table types with ColumnType for proper Kysely type mapping
 * NOTE: Organizations, teams, members, and roles are managed by Better Auth organization plugin
 */
export interface Database {
  // Core tables (all within organization scope)
  users: UserTable; // System users
  connections: MCPConnectionTable; // MCP connections (organization-scoped)
  organization_settings: OrganizationSettingsTable; // Organization-level configuration
  api_keys: ApiKeyTable; // Better Auth API keys
  audit_logs: AuditLogTable; // Audit trail

  // OAuth tables (for MCP OAuth server)
  oauth_clients: OAuthClientTable;
  oauth_authorization_codes: OAuthAuthorizationCodeTable;
  oauth_refresh_tokens: OAuthRefreshTokenTable;
  downstream_tokens: DownstreamTokenTable;
}
