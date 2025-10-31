/**
 * Database Types for MCP Mesh
 * 
 * These TypeScript interfaces define the database schema using Kysely's type-only approach.
 * The dialect (SQLite, PostgreSQL, MySQL) is determined at runtime from DATABASE_URL.
 * 
 * Key Principles:
 * - Database = Organization boundary (all users are org members)
 * - Projects = Namespaces (like Kubernetes, isolate resources not users)
 * - Access control via roles and permissions, not explicit membership
 */

import type { ColumnType } from 'kysely';

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
 * User table definition - Organization member
 * Managed by Better Auth, but defined here for reference
 */
export interface UserTable {
  id: string;
  email: string;
  name: string;
  role: string; // 'admin' | 'user' | custom roles
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}

/**
 * Project table definition - Namespace-scoped resources (like Kubernetes namespaces)
 * Projects isolate resources, not users
 */
export interface ProjectTable {
  id: string;
  slug: string; // URL-safe, unique within organization
  name: string;
  description: string | null;
  ownerId: string; // User who owns this project
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
 * Project entity - Runtime representation
 */
export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * MCP Connection table definition
 */
export interface MCPConnectionTable {
  id: string;
  projectId: string | null; // null = organization-scoped, string = project-scoped
  createdById: string; // User who created this connection
  name: string;
  description: string | null;
  icon: string | null;
  appName: string | null;
  appId: string | null;

  // Connection details
  connectionType: 'HTTP' | 'SSE' | 'Websocket';
  connectionUrl: string;
  connectionToken: string | null; // Encrypted
  connectionHeaders: JsonObject<Record<string, string>> | null;

  // OAuth config for downstream MCP (if MCP supports OAuth)
  oauthConfig: JsonObject<OAuthConfig> | null;

  // Metadata and discovery
  metadata: JsonObject<Record<string, any>> | null;
  tools: JsonArray<ToolDefinition[]> | null; // Discovered tools from MCP
  bindings: JsonArray<string[]> | null; // Detected bindings (CHAT, EMAIL, etc.)

  status: 'active' | 'inactive' | 'error';
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}

/**
 * MCP Connection entity - Runtime representation
 */
export interface MCPConnection {
  id: string;
  projectId: string | null;
  createdById: string;
  name: string;
  description: string | null;
  icon: string | null;
  appName: string | null;
  appId: string | null;

  connectionType: 'HTTP' | 'SSE' | 'Websocket';
  connectionUrl: string;
  connectionToken: string | null;
  connectionHeaders: Record<string, string> | null;

  oauthConfig: OAuthConfig | null;

  metadata: Record<string, any> | null;
  tools: ToolDefinition[] | null;
  bindings: string[] | null;

  status: 'active' | 'inactive' | 'error';
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * OAuth configuration for downstream MCP
 */
export interface OAuthConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  introspectionEndpoint?: string;
  clientId: string;
  clientSecret?: string; // Encrypted
  scopes: string[];
  grantType: 'authorization_code' | 'client_credentials';
}

/**
 * Tool definition from MCP discovery
 */
export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: object;
  outputSchema?: object;
}

/**
 * Role table definition
 */
export interface RoleTable {
  id: string;
  projectId: string; // Roles can be project-specific
  name: string;
  description: string | null;
  permissions: JsonObject<Permission>; // { [resource]: [actions...] }
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}

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
  metadata: JsonObject<Record<string, any>> | null;
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}

/**
 * Audit Log table definition
 */
export interface AuditLogTable {
  id: string;
  projectId: string | null; // null = organization-level action
  userId: string | null;
  connectionId: string | null;
  toolName: string; // Tool that was called
  allowed: number; // SQLite boolean (0 or 1)
  duration: number | null; // Execution time in ms
  timestamp: ColumnType<Date, Date | string, never>;
  requestMetadata: JsonObject<Record<string, any>> | null;
}

/**
 * Role entity - Runtime representation
 */
export interface Role {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  permissions: Permission;
  createdAt: Date | string;
  updatedAt: Date | string;
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
  metadata: Record<string, any> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Audit Log entity - Runtime representation
 */
export interface AuditLog {
  id: string;
  projectId: string | null;
  userId: string | null;
  connectionId: string | null;
  toolName: string;
  allowed: boolean;
  duration: number | null;
  timestamp: Date | string;
  requestMetadata: Record<string, any> | null;
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
 */
export interface Database {
  // Core tables (all within organization scope)
  users: UserTable; // Organization members
  projects: ProjectTable; // Namespaces within organization
  connections: MCPConnectionTable; // MCP connections (org or project scoped)
  roles: RoleTable; // Roles with permissions
  api_keys: ApiKeyTable; // Better Auth API keys
  audit_logs: AuditLogTable; // Audit trail

  // OAuth tables (for MCP OAuth server)
  oauth_clients: OAuthClientTable;
  oauth_authorization_codes: OAuthAuthorizationCodeTable;
  oauth_refresh_tokens: OAuthRefreshTokenTable;
  downstream_tokens: DownstreamTokenTable;
}

