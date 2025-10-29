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

// Helper to create mock context
const createMockContext = (overrides?: Partial<MeshContext>): MeshContext => ({
  auth: {},
  storage: {
    projects: null,
    connections: null,
  },
  vault: null as any,
  authInstance: null,
  access: null as any,
  db: null as any,
  tracer: null as any,
  meter: null as any,
  baseUrl: 'https://mesh.example.com',
  metadata: {
    requestId: 'req_123',
    timestamp: new Date(),
  },
  ...overrides,
});

describe('MeshContext Utilities', () => {
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

    it('should prefer user ID over API key userId', () => {
      const ctx = createMockContext({
        auth: {
          user: { id: 'user_1', email: '[email protected]', name: 'Test', role: 'user' },
          apiKey: {
            id: 'key_1',
            name: 'Test Key',
            userId: 'user_2',
            permissions: {},
          },
        },
      });
      expect(getUserId(ctx)).toBe('user_1');
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
    it('should not throw when authenticated with user', () => {
      const ctx = createMockContext({
        auth: {
          user: { id: 'user_1', email: '[email protected]', name: 'Test', role: 'user' },
        },
      });
      expect(() => requireAuth(ctx)).not.toThrow();
    });

    it('should not throw when authenticated with API key', () => {
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
      expect(() => requireAuth(ctx)).not.toThrow();
    });

    it('should throw when not authenticated', () => {
      const ctx = createMockContext();
      expect(() => requireAuth(ctx)).toThrow('Authentication required');
    });
  });
});

