# Task 05: MeshContext Interface

## Overview
Define the MeshContext interface - the core abstraction that provides all necessary services to tools without coupling them to HTTP or database specifics.

## Dependencies
- `01-database-types.md` (needs Database, Permission types)
- `03-storage-connections.md` (needs ConnectionStorage interface)

## Context from Spec

MeshContext is the **single source of truth** for all tool implementations. It provides:
- Authentication state (user, API key)
- Project scope (if any)
- Storage interfaces (database-agnostic)
- Security services (vault, access control)
- Observability (tracer, meter)
- Request metadata

**Key principle:** Tools NEVER access HTTP objects, database drivers, or environment variables directly.

## Implementation Steps

### 1. Create core context interface

**Location:** `apps/mesh/src/core/mesh-context.ts`

```typescript
import type { Tracer } from '@opentelemetry/api';
import type { Meter } from '@opentelemetry/api';
import type { Kysely } from 'kysely';
import type { Database, Permission } from '../storage/types';
import type { BetterAuthInstance } from 'better-auth';

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

/**
 * Project scope (namespace-level)
 */
export interface ProjectScope {
  id: string;
  slug: string;
  ownerId: string;
}

/**
 * Request metadata (non-HTTP specific)
 */
export interface RequestMetadata {
  requestId: string;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Storage interfaces
 */
export interface MeshStorage {
  projects: any; // ProjectStorage (defined in task 04)
  connections: any; // ConnectionStorage (from task 03)
  policies: any; // PolicyStorage (defined in task 16)
  roles: any; // RoleStorage (defined in task 17)
  tokens: any; // AccessTokenStorage (defined in task 18)
  tokenRevocations: any; // TokenRevocationStorage
  teams: any; // TeamStorage (defined in task 24)
  auditLogs: any; // AuditLogStorage (defined in task 23)
}

/**
 * MeshContext - Core abstraction for all tools
 * 
 * This is passed to every tool handler and provides access to all
 * necessary services without coupling to HTTP framework or database drivers.
 */
export interface MeshContext {
  // Authentication (via Better Auth)
  auth: MeshAuth;
  
  // Project scope (undefined = organization-scoped, defined = project-scoped)
  project?: ProjectScope;
  
  // Storage interfaces (database-agnostic)
  storage: MeshStorage;
  
  // Security services
  vault: any; // CredentialVault (defined in task 10)
  authInstance: BetterAuthInstance; // Better Auth instance
  
  // Access control (for authorization)
  access: any; // AccessControl (defined in task 07)
  
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
```

### 2. Add utility type guards

```typescript
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
```

## File Locations

```
apps/mesh/src/
  core/
    mesh-context.ts    # MeshContext interface and utilities
```

## Testing

Create `apps/mesh/src/core/mesh-context.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  type MeshContext,
  isProjectScoped,
  isOrganizationScoped,
  getProjectId,
  requireProjectScope,
  getUserId,
  isAuthenticated,
  requireAuth,
} from './mesh-context';

describe('MeshContext Utilities', () => {
  const createMockContext = (overrides?: Partial<MeshContext>): MeshContext => ({
    auth: {},
    storage: {} as any,
    vault: {} as any,
    authInstance: {} as any,
    access: {} as any,
    db: {} as any,
    tracer: {} as any,
    meter: {} as any,
    baseUrl: 'https://mesh.example.com',
    metadata: {
      requestId: 'req_123',
      timestamp: new Date(),
    },
    ...overrides,
  });

  describe('isProjectScoped', () => {
    it('should return true when project is defined', () => {
      const ctx = createMockContext({
        project: { id: 'proj_1', slug: 'test', ownerId: 'user_1' },
      });
      expect(isProjectScoped(ctx)).toBe(true);
    });

    it('should return false when project is undefined', () => {
      const ctx = createMockContext();
      expect(isProjectScoped(ctx)).toBe(false);
    });
  });

  describe('isOrganizationScoped', () => {
    it('should return true when project is undefined', () => {
      const ctx = createMockContext();
      expect(isOrganizationScoped(ctx)).toBe(true);
    });

    it('should return false when project is defined', () => {
      const ctx = createMockContext({
        project: { id: 'proj_1', slug: 'test', ownerId: 'user_1' },
      });
      expect(isOrganizationScoped(ctx)).toBe(false);
    });
  });

  describe('getProjectId', () => {
    it('should return project ID when project-scoped', () => {
      const ctx = createMockContext({
        project: { id: 'proj_1', slug: 'test', ownerId: 'user_1' },
      });
      expect(getProjectId(ctx)).toBe('proj_1');
    });

    it('should return null when organization-scoped', () => {
      const ctx = createMockContext();
      expect(getProjectId(ctx)).toBeNull();
    });
  });

  describe('requireProjectScope', () => {
    it('should return project when project-scoped', () => {
      const project = { id: 'proj_1', slug: 'test', ownerId: 'user_1' };
      const ctx = createMockContext({ project });
      expect(requireProjectScope(ctx)).toEqual(project);
    });

    it('should throw when organization-scoped', () => {
      const ctx = createMockContext();
      expect(() => requireProjectScope(ctx)).toThrow(
        'This operation requires project scope'
      );
    });
  });

  describe('getUserId', () => {
    it('should return user ID when user is authenticated', () => {
      const ctx = createMockContext({
        auth: {
          user: { id: 'user_1', email: '[email protected]', name: 'Test', role: 'user' },
        },
      });
      expect(getUserId(ctx)).toBe('user_1');
    });

    it('should return API key userId when API key is used', () => {
      const ctx = createMockContext({
        auth: {
          apiKey: {
            id: 'key_1',
            name: 'Test Key',
            userId: 'user_2',
            permissions: {},
          },
        },
      });
      expect(getUserId(ctx)).toBe('user_2');
    });

    it('should return undefined when not authenticated', () => {
      const ctx = createMockContext();
      expect(getUserId(ctx)).toBeUndefined();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user is authenticated', () => {
      const ctx = createMockContext({
        auth: {
          user: { id: 'user_1', email: '[email protected]', name: 'Test', role: 'user' },
        },
      });
      expect(isAuthenticated(ctx)).toBe(true);
    });

    it('should return true when API key is used', () => {
      const ctx = createMockContext({
        auth: {
          apiKey: {
            id: 'key_1',
            name: 'Test',
            userId: 'user_1',
            permissions: {},
          },
        },
      });
      expect(isAuthenticated(ctx)).toBe(true);
    });

    it('should return false when not authenticated', () => {
      const ctx = createMockContext();
      expect(isAuthenticated(ctx)).toBe(false);
    });
  });

  describe('requireAuth', () => {
    it('should not throw when authenticated', () => {
      const ctx = createMockContext({
        auth: {
          user: { id: 'user_1', email: '[email protected]', name: 'Test', role: 'user' },
        },
      });
      expect(() => requireAuth(ctx)).not.toThrow();
    });

    it('should throw when not authenticated', () => {
      const ctx = createMockContext();
      expect(() => requireAuth(ctx)).toThrow('Authentication required');
    });
  });
});
```

Run: `bun test apps/mesh/src/core/mesh-context.test.ts`

## Validation

- [ ] MeshContext interface compiles without errors
- [ ] All utility functions work correctly
- [ ] Type guards accurately check scope
- [ ] Helper functions throw appropriate errors
- [ ] Tests pass

## Reference

See spec section: **MeshContext: The Core Abstraction** (lines 179-247)

