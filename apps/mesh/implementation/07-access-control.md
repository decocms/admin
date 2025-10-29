# Task 07: Access Control Implementation

## Overview
Implement the AccessControl class that provides authorization checking using Better Auth's permission system.

## Dependencies
- `05-mesh-context.md` (needs MeshAuth types)
- `01-database-types.md` (needs Permission type)

## Context from Spec

Access control follows a grant-based model:
1. Tools call `ctx.access.check()` to verify permissions
2. If allowed, access is granted internally
3. Middleware verifies that access was granted
4. Tools can manually grant access for custom logic

Uses Better Auth's permission model: `{ [resource]: [actions...] }`

## Implementation Steps

### 1. Create AccessControl class

**Location:** `apps/mesh/src/core/access-control.ts`

```typescript
import type { BetterAuthInstance } from 'better-auth';
import type { Permission } from '../storage/types';

/**
 * Custom error for access denial
 */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * AccessControl using Better Auth's permission system
 */
export class AccessControl {
  private _granted: boolean = false;
  
  constructor(
    private auth: BetterAuthInstance,
    private userId?: string,
    private toolName?: string,
    private permissions?: Permission, // From API key
    private role?: string, // From user session
    private connectionId?: string // For connection-specific checks
  ) {}
  
  /**
   * Grant access unconditionally
   * Use for manual overrides, admin actions, or custom validation
   */
  grant(): void {
    this._granted = true;
  }
  
  /**
   * Check permissions and grant access if allowed
   * 
   * @param resources - Resources to check (OR logic)
   * If omitted, checks the current tool name
   * 
   * @throws ForbiddenError if access is denied
   * 
   * @example
   * await ctx.access.check(); // Check current tool
   * await ctx.access.check('conn_<UUID>'); // Check connection access
   * await ctx.access.check('TOOL1', 'TOOL2'); // Check TOOL1 OR TOOL2
   */
  async check(...resources: string[]): Promise<void> {
    // If already granted, skip check
    if (this._granted) {
      return;
    }
    
    // Determine what to check
    const resourcesToCheck = resources.length > 0 
      ? resources 
      : this.toolName ? [this.toolName] : [];
    
    if (resourcesToCheck.length === 0) {
      throw new ForbiddenError('No resources specified for access check');
    }
    
    // Try each resource - if ANY succeeds, grant access (OR logic)
    for (const resource of resourcesToCheck) {
      const hasAccess = await this.checkResource(resource);
      if (hasAccess) {
        this.grant();
        return;
      }
    }
    
    // No permission found
    throw new ForbiddenError(
      `Access denied to: ${resourcesToCheck.join(', ')}`
    );
  }
  
  /**
   * Check if user has permission to access a resource
   */
  private async checkResource(resource: string): Promise<boolean> {
    // No user or permissions = deny
    if (!this.userId && !this.permissions) {
      return false;
    }
    
    // Admin role bypasses all checks
    if (this.role === 'admin') {
      return true;
    }
    
    // Build permission check
    const permissionToCheck: Permission = {
      [resource]: ['*'], // Check for any action
    };
    
    // If checking a specific connection, also check that
    if (this.connectionId) {
      permissionToCheck[this.connectionId] = [resource];
    }
    
    try {
      // Use Better Auth's permission checking if available
      if (this.userId && this.auth.api?.userHasPermission) {
        const result = await this.auth.api.userHasPermission({
          body: {
            userId: this.userId,
            role: this.role,
            permissions: this.permissions,
            permission: permissionToCheck,
          },
        });
        
        return result.data?.has === true;
      }
      
      // Fallback to manual check
      return this.manualPermissionCheck(resource);
    } catch (error) {
      // Fallback to manual check on error
      return this.manualPermissionCheck(resource);
    }
  }
  
  /**
   * Fallback manual permission check
   */
  private manualPermissionCheck(resource: string): boolean {
    if (!this.permissions || Object.keys(this.permissions).length === 0) {
      return false;
    }
    
    // Check permissions object
    for (const [key, actions] of Object.entries(this.permissions)) {
      // If checking specific connection, skip others
      if (this.connectionId && key !== this.connectionId) {
        continue;
      }
      
      // Check if resource matches or has wildcard
      if (key === resource || actions.includes(resource) || actions.includes('*')) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if access was granted
   */
  granted(): boolean {
    return this._granted;
  }
}
```

## File Locations

```
apps/mesh/src/
  core/
    access-control.ts    # AccessControl class
```

## Testing

Create `apps/mesh/src/core/access-control.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AccessControl, ForbiddenError } from './access-control';

const createMockAuth = () => ({
  api: {
    userHasPermission: vi.fn(),
  },
} as any);

describe('AccessControl', () => {
  describe('grant', () => {
    it('should grant access unconditionally', () => {
      const ac = new AccessControl(createMockAuth());
      ac.grant();
      expect(ac.granted()).toBe(true);
    });
  });

  describe('check', () => {
    it('should grant access when permission exists', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        'TEST_TOOL',
        { 'TEST_TOOL': ['*'] }, // Has permission
        'user'
      );

      await ac.check();
      expect(ac.granted()).toBe(true);
    });

    it('should deny access when permission missing', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        'TEST_TOOL',
        { 'OTHER_TOOL': ['*'] }, // Wrong permission
        'user'
      );

      await expect(ac.check()).rejects.toThrow(ForbiddenError);
      expect(ac.granted()).toBe(false);
    });

    it('should check current tool name by default', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        'MY_TOOL',
        { 'MY_TOOL': ['execute'] },
        'user'
      );

      await ac.check();
      expect(ac.granted()).toBe(true);
    });

    it('should check specific resources when provided', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        undefined,
        { 'conn_123': ['SEND_MESSAGE'] },
        'user'
      );

      await ac.check('conn_123');
      expect(ac.granted()).toBe(true);
    });

    it('should use OR logic for multiple resources', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        undefined,
        { 'TOOL2': ['*'] },
        'user'
      );

      // Has TOOL2 but not TOOL1 - should succeed (OR logic)
      await ac.check('TOOL1', 'TOOL2');
      expect(ac.granted()).toBe(true);
    });

    it('should skip check if already granted', async () => {
      const mockAuth = createMockAuth();
      const ac = new AccessControl(mockAuth, 'user_1');
      
      ac.grant(); // Grant first
      
      await ac.check('ANYTHING'); // Should not check
      expect(mockAuth.api.userHasPermission).not.toHaveBeenCalled();
    });

    it('should bypass checks for admin role', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        'TEST_TOOL',
        {}, // No permissions
        'admin' // Admin role
      );

      await ac.check();
      expect(ac.granted()).toBe(true);
    });

    it('should check connection-specific permissions', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        'SEND_MESSAGE',
        { 'conn_123': ['SEND_MESSAGE'] },
        'user',
        'conn_123' // Connection ID
      );

      await ac.check('SEND_MESSAGE');
      expect(ac.granted()).toBe(true);
    });

    it('should throw when no resources specified', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        undefined, // No tool name
        {},
        'user'
      );

      await expect(ac.check()).rejects.toThrow(
        'No resources specified for access check'
      );
    });

    it('should work with wildcard permissions', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        undefined,
        { 'conn_123': ['*'] }, // Wildcard
        'user'
      );

      await ac.check('conn_123');
      expect(ac.granted()).toBe(true);
    });
  });

  describe('granted', () => {
    it('should return false initially', () => {
      const ac = new AccessControl(createMockAuth());
      expect(ac.granted()).toBe(false);
    });

    it('should return true after grant', () => {
      const ac = new AccessControl(createMockAuth());
      ac.grant();
      expect(ac.granted()).toBe(true);
    });

    it('should return true after successful check', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        'TEST_TOOL',
        { 'TEST_TOOL': ['*'] },
        'user'
      );

      await ac.check();
      expect(ac.granted()).toBe(true);
    });
  });
});
```

Run: `bun test apps/mesh/src/core/access-control.test.ts`

## Validation

- [ ] grant() sets granted flag
- [ ] check() validates permissions
- [ ] check() uses OR logic for multiple resources
- [ ] Admin role bypasses checks
- [ ] Skips check if already granted
- [ ] Throws ForbiddenError when denied
- [ ] Works with Better Auth API
- [ ] Falls back to manual check
- [ ] Tests pass

## Reference

See spec section: **Authorization Pattern** (lines 376-736)

