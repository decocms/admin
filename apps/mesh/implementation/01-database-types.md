# Task 01: Database Types (Kysely Schema)

## Overview
Define the complete database schema using Kysely's type-only approach. This creates TypeScript interfaces that work across SQLite, PostgreSQL, and MySQL without dialect-specific code.

## Dependencies
- None (this is the foundation)

## Context from Spec

Kysely uses TypeScript interfaces for schema definition instead of dialect-specific table builders. The dialect is determined once at database initialization from the `DATABASE_URL`.

**Key principles:**
1. **Single dialect specification** - set once, works everywhere
2. **Database = Organization** - The database itself represents the organization boundary
3. **Projects = Namespaces** - Like Kubernetes namespaces, they isolate resources but not users
4. **Users = Organization members** - All users in the database belong to the organization
5. **Access control** - Via roles and permissions, not explicit project/team membership

## Implementation Steps

### 1. Create the database types file

**Location:** `apps/mesh/src/storage/types.ts`

### 2. Define Core Type Utilities

```typescript
import { Generated, ColumnType } from 'kysely';

// Helper for JSON columns that store arrays
export type JsonArray<T> = ColumnType<T[], string, string>;

// Helper for JSON columns that store objects
export type JsonObject<T> = ColumnType<T, string, string>;
```

### 3. Define Entity Interfaces

Create interfaces for each table:

1. **User** (Better Auth managed - organization members)
2. **Project** (namespace-scoped resources, like Kubernetes namespaces)
3. **MCPConnection** (MCP service connections - can be org or project scoped)
4. **Role** (contains permissions)
5. **ApiKey** (Better Auth managed)
6. **AuditLog** (audit trail)
7. **OAuthClient** (for MCP OAuth server)
8. **OAuthAuthorizationCode** (PKCE codes)
9. **OAuthRefreshToken** (refresh tokens)
10. **DownstreamToken** (cached tokens from downstream MCPs)

**Note:** The database itself represents the **organization boundary**. All users in the database are members of the organization. Projects are like Kubernetes namespaces - they provide isolation for resources, but don't have explicit membership. Access to projects is controlled via roles and permissions.

### 4. Define Permission Type

```typescript
// Better Auth permission format: { [resource]: [actions...] }
export type Permission = Record<string, string[]>;
```

### 5. Create Database Schema Interface

```typescript
export interface Database {
  // Core tables (all within organization scope)
  users: User;                     // Organization members
  projects: Project;               // Namespaces within organization
  connections: MCPConnection;      // MCP connections (org or project scoped)
  roles: Role;                     // Roles with permissions
  api_keys: ApiKey;                // Better Auth API keys
  audit_logs: AuditLog;            // Audit trail
  
  // OAuth tables (for MCP OAuth server)
  oauth_clients: OAuthClient;
  oauth_authorization_codes: OAuthAuthorizationCode;
  oauth_refresh_tokens: OAuthRefreshToken;
  downstream_tokens: DownstreamToken;
}
```

## Key Schema Details

### Organization Model

**Important concept:**
- The **database itself** = the **organization** boundary
- All users in the database are organization members
- **Projects** are like Kubernetes namespaces - they isolate resources, not users
- Access control is via **roles** and **permissions**, not explicit membership
- Connections can be **organization-scoped** (shared across all projects) or **project-scoped** (isolated to one project)

### MCPConnection Interface

Must support:
- Discriminated union for connection types (HTTP, SSE, Websocket)
- Optional OAuth config for downstream MCPs
- Detected bindings array
- Project scope (null = organization-scoped, string = project-scoped)

```typescript
export interface MCPConnection {
  id: string;
  projectId: string | null; // null = organization-scoped, string = project-scoped
  createdById: string;      // User who created this connection
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
  tools: JsonArray<ToolDefinition[]> | null;      // Discovered tools from MCP
  bindings: JsonArray<string[]> | null;           // Detected bindings (CHAT, EMAIL, etc.)
  
  status: 'active' | 'inactive' | 'error';
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}

export interface OAuthConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  introspectionEndpoint?: string;
  clientId: string;
  clientSecret?: string; // Encrypted
  scopes: string[];
  grantType: 'authorization_code' | 'client_credentials';
}

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: object;
  outputSchema?: object;
}
```

### Project Interface

```typescript
export interface Project {
  id: string;
  slug: string; // URL-safe, unique
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}
```

### User Interface

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role: string; // 'admin' | 'user' | custom roles
  // Better Auth manages other fields (password, sessions, etc.)
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}
```

### Role Interface

```typescript
export interface Role {
  id: string;
  projectId: string; // Roles can be project-specific
  name: string;
  description: string | null;
  permissions: JsonObject<Permission>; // { [resource]: [actions...] }
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}
```

### ApiKey Interface

```typescript
export interface ApiKey {
  id: string;
  userId: string;              // Owner of this API key
  name: string;
  hashedKey: string;           // Hashed API key (Better Auth handles this)
  permissions: JsonObject<Permission>; // { [resource]: [actions...] }
  expiresAt: ColumnType<Date, Date | string, never> | null;
  remaining: number | null;    // Request quota
  metadata: JsonObject<Record<string, any>> | null;
  createdAt: ColumnType<Date, Date | string, never>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}
```

### AuditLog Interface

```typescript
export interface AuditLog {
  id: string;
  projectId: string | null;    // null = organization-level action
  userId: string | null;
  connectionId: string | null;
  toolName: string;            // Tool that was called
  allowed: boolean;            // Whether access was granted
  duration: number | null;     // Execution time in ms
  timestamp: ColumnType<Date, Date | string, never>;
  requestMetadata: JsonObject<Record<string, any>> | null;
}
```

## File Locations

```
apps/mesh/src/
  storage/
    types.ts         # All type definitions
```

## Testing

Create `apps/mesh/src/storage/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Database, MCPConnection, Permission } from './types';

describe('Database Types', () => {
  it('should allow valid Permission format', () => {
    const permission: Permission = {
      'conn_abc123': ['SEND_MESSAGE', 'LIST_THREADS'],
      'mcp': ['PROJECT_CREATE', 'PROJECT_LIST'],
    };
    expect(permission).toBeDefined();
  });
  
  it('should allow organization-scoped connection', () => {
    const conn: Partial<MCPConnection> = {
      id: 'conn_123',
      projectId: null, // Organization-scoped
      name: 'Test',
      connectionType: 'HTTP',
      connectionUrl: 'https://example.com',
    };
    expect(conn.projectId).toBeNull();
  });
  
  it('should allow project-scoped connection', () => {
    const conn: Partial<MCPConnection> = {
      id: 'conn_123',
      projectId: 'proj_abc', // Project-scoped
      name: 'Test',
      connectionType: 'HTTP',
      connectionUrl: 'https://example.com',
    };
    expect(conn.projectId).toBe('proj_abc');
  });
});
```

Run: `bun test apps/mesh/src/storage/types.test.ts`

## Validation

- [ ] All interfaces compile without errors
- [ ] Permission type matches Better Auth format: `{ [resource]: [actions...] }`
- [ ] MCPConnection supports both organization-scoped (projectId = null) and project-scoped (projectId = string)
- [ ] Database represents organization boundary (all users are org members)
- [ ] Projects are namespaces without explicit membership
- [ ] No team/project member tables (access via roles/permissions)
- [ ] Date columns use ColumnType for proper type mapping
- [ ] JSON columns use JsonArray/JsonObject helpers
- [ ] Tests pass

## Reference

See spec section: **Database Model** (lines 3296-3475)

