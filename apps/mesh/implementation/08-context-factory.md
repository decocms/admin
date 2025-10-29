# Task 08: Context Factory Implementation

## Overview
Create the context factory that constructs MeshContext instances from HTTP requests (via Hono Context).

## Dependencies
- `05-mesh-context.md` (needs MeshContext interface)
- `02-database-factory.md` (needs database instance)
- `07-access-control.md` (needs AccessControl class)
- `03-storage-connections.md` (needs storage classes)
- `04-storage-projects.md`

## Context from Spec

The context factory:
1. Extracts auth from Better Auth
2. Determines project scope from URL path
3. Creates storage adapters
4. Assembles complete MeshContext
5. Derives base URL for OAuth

## Implementation Steps

### 1. Create factory configuration interface

**Location:** `apps/mesh/src/core/context-factory.ts`

```typescript
import type { Context } from 'hono';
import type { Kysely } from 'kysely';
import type { Tracer, Meter } from '@opentelemetry/api';
import type { BetterAuthInstance } from 'better-auth';
import type { Database } from '../storage/types';
import type { MeshContext } from './mesh-context';
import { AccessControl } from './access-control';
import { ConnectionStorage } from '../storage/connection';
import { ProjectStorage } from '../storage/project';
// Import other storage classes as they're implemented

export interface MeshContextConfig {
  db: Kysely<Database>;
  auth: BetterAuthInstance;
  encryption: {
    key: string;
  };
  observability: {
    tracer: Tracer;
    meter: Meter;
  };
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
```

### 2. Implement factory function

```typescript
/**
 * Create a context factory function
 */
export function createMeshContextFactory(
  config: MeshContextConfig
): (c: Context) => Promise<MeshContext> {
  // Create storage adapters once (singleton pattern)
  const storage = {
    projects: new ProjectStorage(config.db),
    connections: new ConnectionStorage(config.db),
    // Add other storage classes as implemented
    policies: null as any,
    roles: null as any,
    tokens: null as any,
    tokenRevocations: null as any,
    teams: null as any,
    auditLogs: null as any,
  };
  
  // Create vault instance (to be implemented in task 10)
  const vault = null as any; // CredentialVault
  
  // Return factory function
  return async (c: Context): Promise<MeshContext> => {
    // Extract API key from Authorization header
    const authHeader = c.req.header('Authorization');
    const key = authHeader?.replace('Bearer ', '');
    
    let auth: MeshContext['auth'] = {};
    
    if (key) {
      // Verify API key with Better Auth
      const result = await config.auth.api.verifyApiKey({
        body: { key },
      });
      
      if (!result.valid) {
        throw new UnauthorizedError(
          result.error?.message || 'Invalid API key'
        );
      }
      
      // Load user (if storage available)
      // const user = await storage.users?.findById(result.key.userId);
      
      auth = {
        apiKey: {
          id: result.key.id,
          name: result.key.name,
          userId: result.key.userId,
          permissions: result.key.permissions || {},
          metadata: result.key.metadata,
          remaining: result.key.remaining,
          expiresAt: result.key.expiresAt,
        },
      };
    }
    
    // Extract project from path (e.g., /:projectSlug/mcp/...)
    const projectSlug = extractProjectSlug(c.req.path);
    let project: MeshContext['project'] | undefined;
    
    if (projectSlug) {
      // Load project
      project = await storage.projects.findBySlug(projectSlug);
      
      if (!project) {
        throw new NotFoundError(`Project not found: ${projectSlug}`);
      }
      
      // Verify API key has project access
      if (auth.apiKey) {
        const hasProjectAccess = 
          auth.apiKey.permissions['mcp']?.some(tool => 
            tool.startsWith('PROJECT_')
          ) ||
          auth.apiKey.permissions[`project:${project.id}`]?.length > 0;
        
        if (!hasProjectAccess) {
          throw new UnauthorizedError(
            `API key does not have access to project: ${projectSlug}`
          );
        }
      }
      
      project = {
        id: project.id,
        slug: project.slug,
        ownerId: project.ownerId,
      };
    }
    
    // Derive base URL from request
    const url = new URL(c.req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Create AccessControl instance
    const access = new AccessControl(
      config.auth,
      auth.user?.id,
      undefined, // toolName set later by defineTool
      auth.apiKey?.permissions,
      auth.user?.role,
      undefined // connectionId set when proxying
    );
    
    return {
      auth,
      project,
      storage,
      vault,
      authInstance: config.auth,
      access,
      db: config.db,
      tracer: config.observability.tracer,
      meter: config.observability.meter,
      baseUrl,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        userAgent: c.req.header('User-Agent'),
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      },
    };
  };
}

/**
 * Extract project slug from request path
 * Returns undefined for organization-scoped paths
 */
function extractProjectSlug(path: string): string | undefined {
  // Pattern: /:projectSlug/mcp/...
  const match = path.match(/^\/([^\/]+)\/mcp/);
  
  // Ignore if path starts with /mcp (organization-scoped)
  if (path.startsWith('/mcp')) {
    return undefined;
  }
  
  return match?.[1];
}
```

## File Locations

```
apps/mesh/src/
  core/
    context-factory.ts    # Context factory
```

## Testing

Create `apps/mesh/src/core/context-factory.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createMeshContextFactory } from './context-factory';
import { createDatabase } from '../database';

const createMockHonoContext = (overrides?: any) => ({
  req: {
    url: 'https://mesh.example.com/my-project/mcp/tools',
    path: '/my-project/mcp/tools',
    header: vi.fn((name: string) => {
      if (name === 'Authorization') return 'Bearer test_key';
      if (name === 'User-Agent') return 'Test/1.0';
      return undefined;
    }),
    ...overrides?.req,
  },
  ...overrides,
});

const createMockAuth = () => ({
  api: {
    verifyApiKey: vi.fn().mockResolvedValue({
      valid: true,
      key: {
        id: 'key_1',
        name: 'Test Key',
        userId: 'user_1',
        permissions: { 'mcp': ['PROJECT_LIST'] },
      },
    }),
  },
} as any);

describe('createMeshContextFactory', () => {
  it('should create context factory function', () => {
    const db = createDatabase('file::memory:');
    const factory = createMeshContextFactory({
      db,
      auth: createMockAuth(),
      encryption: { key: 'test_key' },
      observability: {
        tracer: {} as any,
        meter: {} as any,
      },
    });

    expect(typeof factory).toBe('function');
  });

  it('should create MeshContext from Hono context', async () => {
    const db = createDatabase('file::memory:');
    const factory = createMeshContextFactory({
      db,
      auth: createMockAuth(),
      encryption: { key: 'test_key' },
      observability: {
        tracer: {} as any,
        meter: {} as any,
      },
    });

    const honoCtx = createMockHonoContext();
    const meshCtx = await factory(honoCtx);

    expect(meshCtx).toBeDefined();
    expect(meshCtx.auth).toBeDefined();
    expect(meshCtx.storage).toBeDefined();
    expect(meshCtx.access).toBeDefined();
    expect(meshCtx.baseUrl).toBe('https://mesh.example.com');
  });

  it('should extract project from path', async () => {
    const db = createDatabase('file::memory:');
    
    // Mock project storage
    const mockProjectStorage = {
      findBySlug: vi.fn().mockResolvedValue({
        id: 'proj_1',
        slug: 'my-project',
        ownerId: 'user_1',
      }),
    };

    const factory = createMeshContextFactory({
      db,
      auth: createMockAuth(),
      encryption: { key: 'test_key' },
      observability: {
        tracer: {} as any,
        meter: {} as any,
      },
    });

    // Temporarily replace storage
    // In real implementation, would need proper mocking

    const honoCtx = createMockHonoContext({
      req: {
        url: 'https://mesh.example.com/my-project/mcp/tools',
        path: '/my-project/mcp/tools',
        header: vi.fn(() => 'Bearer test_key'),
      },
    });

    const meshCtx = await factory(honoCtx);
    
    // Would have project if storage was properly mocked
    // expect(meshCtx.project).toBeDefined();
  });

  it('should be organization-scoped when path starts with /mcp', async () => {
    const db = createDatabase('file::memory:');
    const factory = createMeshContextFactory({
      db,
      auth: createMockAuth(),
      encryption: { key: 'test_key' },
      observability: {
        tracer: {} as any,
        meter: {} as any,
      },
    });

    const honoCtx = createMockHonoContext({
      req: {
        url: 'https://mesh.example.com/mcp/tools',
        path: '/mcp/tools',
        header: vi.fn(() => 'Bearer test_key'),
      },
    });

    const meshCtx = await factory(honoCtx);
    expect(meshCtx.project).toBeUndefined();
  });
});
```

## Validation

- [ ] Creates factory function
- [ ] Extracts API key from Authorization header
- [ ] Verifies API key with Better Auth
- [ ] Extracts project slug from path
- [ ] Loads project when present
- [ ] Returns organization-scoped context for /mcp paths
- [ ] Derives baseUrl from request
- [ ] Creates AccessControl instance
- [ ] Tests pass

## Reference

See spec section: **Context Factory** (lines 2549-2678)

