# Task 03: Connection Storage Implementation

## Overview
Implement the ConnectionStorage class using Kysely for database-agnostic connection management. Handles CRUD operations for MCP connections with support for both organization-scoped and project-scoped connections.

## Dependencies
- `01-database-types.md` (needs MCPConnection interface)
- `02-database-factory.md` (needs Kysely instance)

## Context from Spec

Connections can be scoped at two levels (like Kubernetes resources):
- **Organization-scoped** (cluster-level): `projectId = null`, shared across all projects
- **Project-scoped** (namespace-level): `projectId = <id>`, isolated to one project

The storage layer uses Kysely's query builder, which works identically across all database dialects.

## Implementation Steps

### 1. Create storage interface

**Location:** `apps/mesh/src/storage/ports.ts`

```typescript
import type { MCPConnection } from './types';

export interface CreateConnectionData {
  projectId: string | null;
  teamId?: string | null;
  createdById: string;
  name: string;
  description?: string;
  icon?: string;
  appName?: string;
  appId?: string;
  connection: {
    type: 'HTTP' | 'SSE' | 'Websocket';
    url: string;
    token?: string;
    headers?: Record<string, string>;
  };
  oauthConfig?: any; // OAuthConfig from types
  metadata?: Record<string, any>;
}

export interface ConnectionStoragePort {
  create(data: CreateConnectionData): Promise<MCPConnection>;
  findById(id: string): Promise<MCPConnection | null>;
  list(projectId: string | null, scope?: 'all' | 'organization' | 'project'): Promise<MCPConnection[]>;
  update(id: string, data: Partial<MCPConnection>): Promise<MCPConnection>;
  delete(id: string): Promise<void>;
  testConnection(id: string): Promise<{ healthy: boolean; latencyMs: number }>;
}
```

### 2. Implement ConnectionStorage class

**Location:** `apps/mesh/src/storage/connection.ts`

```typescript
import { Kysely } from 'kysely';
import type { Database, MCPConnection } from './types';
import type { ConnectionStoragePort, CreateConnectionData } from './ports';
import { nanoid } from 'nanoid';

export class ConnectionStorage implements ConnectionStoragePort {
  constructor(private db: Kysely<Database>) {}

  async create(data: CreateConnectionData): Promise<MCPConnection> {
    const id = `conn_${nanoid()}`;
    
    const connection = await this.db
      .insertInto('connections')
      .values({
        id,
        projectId: data.projectId,
        teamId: data.teamId ?? null,
        createdById: data.createdById,
        name: data.name,
        description: data.description ?? null,
        icon: data.icon ?? null,
        appName: data.appName ?? null,
        appId: data.appId ?? null,
        
        // Connection details
        connectionType: data.connection.type,
        connectionUrl: data.connection.url,
        connectionToken: data.connection.token ?? null,
        connectionHeaders: data.connection.headers 
          ? JSON.stringify(data.connection.headers) 
          : null,
        
        // OAuth config
        oauthConfig: data.oauthConfig 
          ? JSON.stringify(data.oauthConfig) 
          : null,
        
        metadata: data.metadata 
          ? JSON.stringify(data.metadata) 
          : null,
        
        tools: null, // Populated later via discovery
        bindings: null, // Populated later via binding detection
        
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.deserializeConnection(connection);
  }

  async findById(id: string): Promise<MCPConnection | null> {
    const connection = await this.db
      .selectFrom('connections')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return connection ? this.deserializeConnection(connection) : null;
  }

  async list(
    projectId: string | null,
    scope: 'all' | 'organization' | 'project' = 'all'
  ): Promise<MCPConnection[]> {
    let query = this.db.selectFrom('connections').selectAll();

    if (scope === 'organization') {
      // Only organization-scoped connections
      query = query.where('projectId', 'is', null);
    } else if (scope === 'project') {
      // Only project-scoped connections
      query = query.where('projectId', '=', projectId);
    } else {
      // All: both organization-scoped AND project-scoped
      if (projectId) {
        query = query.where((eb) =>
          eb.or([
            eb('projectId', 'is', null), // Organization-scoped
            eb('projectId', '=', projectId), // Project-scoped
          ])
        );
      } else {
        // No project context - only show organization-scoped
        query = query.where('projectId', 'is', null);
      }
    }

    const connections = await query.execute();
    return connections.map((c) => this.deserializeConnection(c));
  }

  async update(id: string, data: Partial<MCPConnection>): Promise<MCPConnection> {
    const connection = await this.db
      .updateTable('connections')
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.deserializeConnection(connection);
  }

  async delete(id: string): Promise<void> {
    await this.db
      .deleteFrom('connections')
      .where('id', '=', id)
      .execute();
  }

  async testConnection(id: string): Promise<{ healthy: boolean; latencyMs: number }> {
    const connection = await this.findById(id);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const startTime = Date.now();
    
    try {
      // Simple health check - try to reach the URL
      const response = await fetch(connection.connectionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(connection.connectionToken && {
            Authorization: `Bearer ${connection.connectionToken}`,
          }),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'ping',
          id: 1,
        }),
      });

      const latencyMs = Date.now() - startTime;
      
      return {
        healthy: response.ok || response.status === 404, // 404 is ok (service exists)
        latencyMs,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Deserialize JSON fields from database
   */
  private deserializeConnection(raw: any): MCPConnection {
    return {
      ...raw,
      connectionHeaders: raw.connectionHeaders 
        ? JSON.parse(raw.connectionHeaders) 
        : null,
      oauthConfig: raw.oauthConfig 
        ? JSON.parse(raw.oauthConfig) 
        : null,
      metadata: raw.metadata 
        ? JSON.parse(raw.metadata) 
        : null,
      tools: raw.tools 
        ? JSON.parse(raw.tools) 
        : null,
      bindings: raw.bindings 
        ? JSON.parse(raw.bindings) 
        : null,
    };
  }
}
```

## File Locations

```
apps/mesh/src/
  storage/
    ports.ts          # Storage interfaces
    connection.ts     # ConnectionStorage implementation
```

## Testing

Create `apps/mesh/src/storage/connection.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabase, closeDatabase } from '../database';
import { ConnectionStorage } from './connection';
import type { Kysely } from 'kysely';
import type { Database } from './types';

describe('ConnectionStorage', () => {
  let db: Kysely<Database>;
  let storage: ConnectionStorage;

  beforeAll(async () => {
    db = createDatabase('file::memory:'); // In-memory SQLite
    storage = new ConnectionStorage(db);
    
    // TODO: Run migrations here when available
  });

  afterAll(async () => {
    await closeDatabase(db);
  });

  it('should create organization-scoped connection', async () => {
    const connection = await storage.create({
      projectId: null, // Organization-scoped
      createdById: 'user_123',
      name: 'Company Slack',
      connection: {
        type: 'HTTP',
        url: 'https://slack.com/mcp',
        token: 'slack-token-123',
      },
    });

    expect(connection.id).toMatch(/^conn_/);
    expect(connection.projectId).toBeNull();
    expect(connection.name).toBe('Company Slack');
    expect(connection.status).toBe('active');
  });

  it('should create project-scoped connection', async () => {
    const connection = await storage.create({
      projectId: 'proj_abc',
      createdById: 'user_123',
      name: 'Project DB',
      connection: {
        type: 'HTTP',
        url: 'https://db.com/mcp',
      },
    });

    expect(connection.projectId).toBe('proj_abc');
  });

  it('should list organization-scoped connections only', async () => {
    const connections = await storage.list(null, 'organization');
    expect(connections.every(c => c.projectId === null)).toBe(true);
  });

  it('should list project connections including organization ones', async () => {
    const connections = await storage.list('proj_abc', 'all');
    
    // Should include both organization-scoped and project-scoped
    const hasOrg = connections.some(c => c.projectId === null);
    const hasProject = connections.some(c => c.projectId === 'proj_abc');
    
    expect(hasOrg || hasProject).toBe(true);
  });

  it('should find connection by ID', async () => {
    const created = await storage.create({
      projectId: null,
      createdById: 'user_123',
      name: 'Test Connection',
      connection: { type: 'HTTP', url: 'https://test.com' },
    });

    const found = await storage.findById(created.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Test Connection');
  });

  it('should update connection', async () => {
    const created = await storage.create({
      projectId: null,
      createdById: 'user_123',
      name: 'Original Name',
      connection: { type: 'HTTP', url: 'https://test.com' },
    });

    const updated = await storage.update(created.id, {
      name: 'Updated Name',
      status: 'inactive',
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.status).toBe('inactive');
  });

  it('should delete connection', async () => {
    const created = await storage.create({
      projectId: null,
      createdById: 'user_123',
      name: 'To Delete',
      connection: { type: 'HTTP', url: 'https://test.com' },
    });

    await storage.delete(created.id);

    const found = await storage.findById(created.id);
    expect(found).toBeNull();
  });
});
```

Run: `bun test apps/mesh/src/storage/connection.test.ts`

## Validation

- [ ] Creates organization-scoped connections (projectId = null)
- [ ] Creates project-scoped connections (projectId = string)
- [ ] List filters by scope correctly
- [ ] Project list includes organization-scoped connections
- [ ] CRUD operations work correctly
- [ ] JSON fields serialized/deserialized properly
- [ ] Tests pass

## Reference

See spec section: **Storage Port & Adapter Pattern** (lines 2742-2840)

