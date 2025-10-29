import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeDatabase, createDatabase } from '../database';
import { createTestSchema } from '../storage/__test-helpers';
import type { Database } from '../storage/types';
import { createMeshContextFactory, NotFoundError } from './context-factory';

describe('createMeshContextFactory', () => {
  let db: Kysely<Database>;

  beforeAll(async () => {
    const tempDbPath = `/tmp/test-context-factory-${Date.now()}.db`;
    db = createDatabase(`file:${tempDbPath}`);
    await createTestSchema(db);
  });

  afterAll(async () => {
    await closeDatabase(db);
  });

  const createMockHonoContext = (overrides?: any) => ({
    req: {
      url: 'https://mesh.example.com/my-project/mcp/tools',
      path: '/my-project/mcp/tools',
      header: vi.fn((name: string) => {
        if (name === 'Authorization') return 'Bearer test_key';
        if (name === 'User-Agent') return 'Test/1.0';
        if (name === 'X-Forwarded-For') return '192.168.1.1';
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
  });

  describe('factory creation', () => {
    it('should create context factory function', () => {
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
  });

  describe('MeshContext creation', () => {
    it('should create MeshContext from Hono context', async () => {
      const factory = createMeshContextFactory({
        db,
        auth: null, // No auth for this test
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
          header: vi.fn(() => undefined), // No Authorization
        },
      });

      const meshCtx = await factory(honoCtx);

      expect(meshCtx).toBeDefined();
      expect(meshCtx.auth).toBeDefined();
      expect(meshCtx.storage).toBeDefined();
      expect(meshCtx.access).toBeDefined();
      expect(meshCtx.baseUrl).toBe('https://mesh.example.com');
      expect(meshCtx.metadata.requestId).toBeDefined();
    });

    it('should derive base URL from request', async () => {
      const factory = createMeshContextFactory({
        db,
        auth: null,
        encryption: { key: 'test_key' },
        observability: {
          tracer: {} as any,
          meter: {} as any,
        },
      });

      const honoCtx = createMockHonoContext({
        req: {
          url: 'http://localhost:3000/mcp/tools',
          path: '/mcp/tools',
          header: vi.fn(() => undefined),
        },
      });

      const meshCtx = await factory(honoCtx);

      expect(meshCtx.baseUrl).toBe('http://localhost:3000');
    });

    it('should populate request metadata', async () => {
      const factory = createMeshContextFactory({
        db,
        auth: null,
        encryption: { key: 'test_key' },
        observability: {
          tracer: {} as any,
          meter: {} as any,
        },
      });

      const honoCtx = createMockHonoContext({
        req: {
          url: 'https://mesh.example.com/mcp/tools',
          path: '/mcp/tools', // Organization-scoped
          header: vi.fn((name: string) => {
            if (name === 'User-Agent') return 'Test/1.0';
            if (name === 'X-Forwarded-For') return '192.168.1.1';
            return undefined;
          }),
        },
      });

      const meshCtx = await factory(honoCtx);

      expect(meshCtx.metadata.userAgent).toBe('Test/1.0');
      expect(meshCtx.metadata.ipAddress).toBe('192.168.1.1');
      expect(meshCtx.metadata.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('project scope extraction', () => {
    it('should be organization-scoped when path starts with /mcp', async () => {
      const factory = createMeshContextFactory({
        db,
        auth: null,
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
          header: vi.fn(() => undefined),
        },
      });

      const meshCtx = await factory(honoCtx);
      expect(meshCtx.project).toBeUndefined();
    });

    it('should extract project slug from path', async () => {
      const factory = createMeshContextFactory({
        db,
        auth: null,
        encryption: { key: 'test_key' },
        observability: {
          tracer: {} as any,
          meter: {} as any,
        },
      });

      // Create a test project first
      await db.insertInto('projects').values({
        id: 'proj_test',
        slug: 'test-project',
        name: 'Test Project',
        description: null,
        ownerId: 'user_1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).execute();

      const honoCtx = createMockHonoContext({
        req: {
          url: 'https://mesh.example.com/test-project/mcp/tools',
          path: '/test-project/mcp/tools',
          header: vi.fn(() => undefined),
        },
      });

      const meshCtx = await factory(honoCtx);

      expect(meshCtx.project).toBeDefined();
      expect(meshCtx.project?.slug).toBe('test-project');
      expect(meshCtx.project?.id).toBe('proj_test');
    });

    it('should throw NotFoundError for non-existent project', async () => {
      const factory = createMeshContextFactory({
        db,
        auth: null,
        encryption: { key: 'test_key' },
        observability: {
          tracer: {} as any,
          meter: {} as any,
        },
      });

      const honoCtx = createMockHonoContext({
        req: {
          url: 'https://mesh.example.com/nonexistent/mcp/tools',
          path: '/nonexistent/mcp/tools',
          header: vi.fn(() => undefined),
        },
      });

      await expect(factory(honoCtx)).rejects.toThrow(NotFoundError);
      await expect(factory(honoCtx)).rejects.toThrow('Project not found: nonexistent');
    });
  });

  describe('storage initialization', () => {
    it('should create storage adapters', async () => {
      const factory = createMeshContextFactory({
        db,
        auth: null,
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
          header: vi.fn(() => undefined),
        },
      });

      const meshCtx = await factory(honoCtx);

      expect(meshCtx.storage.projects).toBeDefined();
      expect(meshCtx.storage.connections).toBeDefined();
    });
  });

  describe('access control initialization', () => {
    it('should create AccessControl instance', async () => {
      const factory = createMeshContextFactory({
        db,
        auth: null,
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
          header: vi.fn(() => undefined),
        },
      });

      const meshCtx = await factory(honoCtx);

      expect(meshCtx.access).toBeDefined();
      expect(meshCtx.access.granted).toBeDefined();
      expect(meshCtx.access.check).toBeDefined();
      expect(meshCtx.access.grant).toBeDefined();
    });
  });
});

