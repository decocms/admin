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

import type { Generated, ColumnType } from 'kysely';

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
 * - Organization-level: { "mcp": ["PROJECT_CREATE", "PROJECT_LIST"] }
 * - Connection-specific: { "conn_<UUID>": ["SEND_MESSAGE", "LIST_THREADS"] }
 */
export type Permission = Record<string, string[]>;

// ============================================================================
// Core Entity Interfaces
// ============================================================================

/**
 * User - Organization member
 * Managed by Better Auth, but defined here for reference
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: string; // 'admin' | 'user' | custom roles
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}

/**
 * Project - Namespace-scoped resources (like Kubernetes namespaces)
 * Projects isolate resources, not users
 */
export interface Project {
  id: string;
  slug: string; // URL-safe, unique within organization
  name: string;
  description: string | null;
  ownerId: string; // User who owns this project
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}

/**
 * MCP Connection - Connection to an MCP service
 * Can be organization-scoped (shared) or project-scoped (isolated)
 */
export interface MCPConnection {
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
 * Role - Named set of permissions
 * Can be project-specific
 */
export interface Role {
  id: string;
  projectId: string; // Roles can be project-specific
  name: string;
  description: string | null;
  permissions: JsonObject<Permission>; // { [resource]: [actions...] }
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}

/**
 * API Key - For programmatic access
 * Managed by Better Auth API Key plugin
 */
export interface ApiKey {
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
 * Audit Log - Track all operations
 */
export interface AuditLog {
  id: string;
  projectId: string | null; // null = organization-level action
  userId: string | null;
  connectionId: string | null;
  toolName: string; // Tool that was called
  allowed: boolean; // Whether access was granted
  duration: number | null; // Execution time in ms
  timestamp: ColumnType<Date, Date | string, never>;
  requestMetadata: JsonObject<Record<string, any>> | null;
}

// ============================================================================
// OAuth Tables (for MCP OAuth server)
// ============================================================================

/**
 * OAuth Client (RFC 7591 - Dynamic Client Registration)
 */
export interface OAuthClient {
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
 * OAuth Authorization Code (PKCE support)
 */
export interface OAuthAuthorizationCode {
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
 * OAuth Refresh Token
 */
export interface OAuthRefreshToken {
  token: string; // Primary key
  clientId: string; // Foreign key
  userId: string;
  scope: string | null;
  expiresAt: ColumnType<Date, Date | string, never> | null;
  createdAt: ColumnType<Date, Date | string, never>;
}

/**
 * Downstream Token - Cache tokens from downstream MCPs
 */
export interface DownstreamToken {
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
// Database Schema
// ============================================================================

/**
 * Complete database schema
 * All tables exist within the organization scope (database boundary)
 */
export interface Database {
  // Core tables (all within organization scope)
  users: User; // Organization members
  projects: Project; // Namespaces within organization
  connections: MCPConnection; // MCP connections (org or project scoped)
  roles: Role; // Roles with permissions
  api_keys: ApiKey; // Better Auth API keys
  audit_logs: AuditLog; // Audit trail
  
  // OAuth tables (for MCP OAuth server)
  oauth_clients: OAuthClient;
  oauth_authorization_codes: OAuthAuthorizationCode;
  oauth_refresh_tokens: OAuthRefreshToken;
  downstream_tokens: DownstreamToken;
}

