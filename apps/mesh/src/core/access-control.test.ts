import { describe, expect, it, vi } from 'vitest';
import { AccessControl, ForbiddenError } from './access-control';

const createMockAuth = () => ({
  api: {
    userHasPermission: vi.fn(),
  },
});

describe('AccessControl', () => {
  describe('grant', () => {
    it('should grant access unconditionally', () => {
      const ac = new AccessControl(createMockAuth());
      ac.grant();
      expect(ac.granted()).toBe(true);
    });

    it('should allow multiple grant calls', () => {
      const ac = new AccessControl(createMockAuth());
      ac.grant();
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

    it('should deny access when no userId or permissions', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        undefined, // No user
        'TEST_TOOL',
        undefined, // No permissions
        undefined
      );

      await expect(ac.check()).rejects.toThrow(ForbiddenError);
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

    it('should return false after failed check', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        'TEST_TOOL',
        {}, // No permissions
        'user' // Not admin
      );

      try {
        await ac.check();
      } catch {
        // Expected to throw
      }

      expect(ac.granted()).toBe(false);
    });
  });

  describe('manual permission check', () => {
    it('should match exact resource name', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        undefined,
        { 'EXACT_MATCH': ['action'] },
        'user'
      );

      await ac.check('EXACT_MATCH');
      expect(ac.granted()).toBe(true);
    });

    it('should match resource in actions array', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        undefined,
        { 'conn_123': ['SEND_MESSAGE', 'LIST_THREADS'] },
        'user'
      );

      await ac.check('SEND_MESSAGE');
      expect(ac.granted()).toBe(true);
    });

    it('should respect connection ID filter', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        undefined,
        {
          'conn_123': ['SEND_MESSAGE'],
          'conn_456': ['SEND_MESSAGE'],
        },
        'user',
        'conn_123' // Only check this connection
      );

      await ac.check('SEND_MESSAGE');
      expect(ac.granted()).toBe(true);
    });

    it('should deny when connection ID does not match', async () => {
      const ac = new AccessControl(
        createMockAuth(),
        'user_1',
        undefined,
        {
          'conn_456': ['SEND_MESSAGE'], // Different connection
        },
        'user',
        'conn_123' // Checking this connection
      );

      await expect(ac.check('SEND_MESSAGE')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('Better Auth integration', () => {
    it('should use Better Auth API when available', async () => {
      const mockAuth = createMockAuth();
      mockAuth.api.userHasPermission.mockResolvedValue({
        data: { has: true },
      });

      const ac = new AccessControl(
        mockAuth,
        'user_1',
        'TEST_TOOL',
        {},
        'user'
      );

      await ac.check();

      expect(mockAuth.api.userHasPermission).toHaveBeenCalledWith({
        body: expect.objectContaining({
          userId: 'user_1',
          role: 'user',
        }),
      });
      expect(ac.granted()).toBe(true);
    });

    it('should fall back to manual check when Better Auth fails', async () => {
      const mockAuth = createMockAuth();
      mockAuth.api.userHasPermission.mockRejectedValue(new Error('API error'));

      const ac = new AccessControl(
        mockAuth,
        'user_1',
        undefined,
        { 'TEST_TOOL': ['*'] },
        'user'
      );

      // Should not throw - falls back to manual check
      await ac.check('TEST_TOOL');
      expect(ac.granted()).toBe(true);
    });

    it('should fall back to manual check when Better Auth not configured', async () => {
      const ac = new AccessControl(
        null, // No auth instance
        'user_1',
        undefined,
        { 'TEST_TOOL': ['*'] },
        'user'
      );

      await ac.check('TEST_TOOL');
      expect(ac.granted()).toBe(true);
    });
  });
});

