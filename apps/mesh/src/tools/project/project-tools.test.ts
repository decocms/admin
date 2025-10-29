import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabase, closeDatabase } from '../../database';
import { createTestSchema } from '../../storage/__test-helpers';
import { PROJECT_CREATE, PROJECT_LIST, PROJECT_GET, PROJECT_UPDATE, PROJECT_DELETE } from './index';
import type { Kysely } from 'kysely';
import type { Database } from '../../storage/types';
import type { MeshContext } from '../../core/mesh-context';
import { ConnectionStorage } from '../../storage/connection';
import { ProjectStorage } from '../../storage/project';

describe('Project Tools', () => {
  let db: Kysely<Database>;
  let ctx: MeshContext;

  beforeAll(async () => {
    const tempDbPath = `/tmp/test-project-tools-${Date.now()}.db`;
    db = createDatabase(`file:${tempDbPath}`);
    await createTestSchema(db);

    // Create mock context
    ctx = {
      auth: {
        user: { id: 'user_1', email: '[email protected]', name: 'Test', role: 'admin' },
      },
      storage: {
        projects: new ProjectStorage(db),
        connections: new ConnectionStorage(db),
        auditLogs: null as any,
        roles: null as any,
      },
      vault: null as any,
      authInstance: null,
      access: {
        granted: () => true,
        check: async () => {},
        grant: () => {},
      } as any,
      db,
      tracer: {
        startActiveSpan: (_name: string, _opts: any, fn: any) => fn({
          setStatus: () => {},
          recordException: () => {},
          end: () => {},
        }),
      } as any,
      meter: {
        createHistogram: () => ({ record: () => {} }),
        createCounter: () => ({ add: () => {} }),
      } as any,
      baseUrl: 'https://mesh.example.com',
      metadata: {
        requestId: 'req_123',
        timestamp: new Date(),
      },
    };
  });

  afterAll(async () => {
    await closeDatabase(db);
  });

  describe('PROJECT_CREATE', () => {
    it('should create a new project', async () => {
      const result = await PROJECT_CREATE.execute({
        slug: 'test-project',
        name: 'Test Project',
        description: 'A test project',
      }, ctx);

      expect(result.id).toMatch(/^proj_/);
      expect(result.slug).toBe('test-project');
      expect(result.name).toBe('Test Project');
      expect(result.description).toBe('A test project');
      expect(result.ownerId).toBe('user_1');
    });

    it('should validate slug format', async () => {
      // Zod validation happens via MCP protocol before execute() is called
      // For direct testing, we parse the input first
      const result = PROJECT_CREATE.inputSchema.safeParse({
        slug: 'Invalid Slug!', // Invalid - has spaces and special char
        name: 'Test',
      });
      
      expect(result.success).toBe(false);
    });

    it('should require authentication', async () => {
      const noAuthCtx = { ...ctx, auth: {} };
      
      await expect(PROJECT_CREATE.execute({
        slug: 'test',
        name: 'Test',
      }, noAuthCtx)).rejects.toThrow('Authentication required');
    });
  });

  describe('PROJECT_LIST', () => {
    it('should list all user projects', async () => {
      // Create a few projects
      await PROJECT_CREATE.execute({
        slug: 'list-1',
        name: 'List 1',
      }, ctx);

      await PROJECT_CREATE.execute({
        slug: 'list-2',
        name: 'List 2',
      }, ctx);

      const result = await PROJECT_LIST.execute({}, ctx);

      expect(result.projects.length).toBeGreaterThanOrEqual(2);
      expect(result.projects.some(p => p.slug === 'list-1')).toBe(true);
    });

    it('should filter by userId', async () => {
      const result = await PROJECT_LIST.execute({
        userId: 'user_1',
      }, ctx);

      expect(result.projects.every(p => p.ownerId === 'user_1')).toBe(true);
    });
  });

  describe('PROJECT_GET', () => {
    it('should get project by slug', async () => {
      await PROJECT_CREATE.execute({
        slug: 'get-by-slug',
        name: 'Get By Slug',
      }, ctx);

      const result = await PROJECT_GET.execute({
        slug: 'get-by-slug',
      }, ctx);

      expect(result.slug).toBe('get-by-slug');
      expect(result.name).toBe('Get By Slug');
    });

    it('should get project by ID', async () => {
      const created = await PROJECT_CREATE.execute({
        slug: 'get-by-id',
        name: 'Get By ID',
      }, ctx);

      const result = await PROJECT_GET.execute({
        id: created.id,
      }, ctx);

      expect(result.id).toBe(created.id);
    });

    it('should throw when project not found', async () => {
      await expect(PROJECT_GET.execute({
        slug: 'nonexistent',
      }, ctx)).rejects.toThrow('Project not found');
    });

    it('should require slug or id', async () => {
      await expect(PROJECT_GET.execute({}, ctx)).rejects.toThrow();
    });
  });

  describe('PROJECT_UPDATE', () => {
    it('should update project name', async () => {
      const created = await PROJECT_CREATE.execute({
        slug: 'update-name',
        name: 'Original',
      }, ctx);

      const result = await PROJECT_UPDATE.execute({
        id: created.id,
        name: 'Updated',
      }, ctx);

      expect(result.name).toBe('Updated');
      expect(result.slug).toBe('update-name'); // Unchanged
    });

    it('should update project slug', async () => {
      const created = await PROJECT_CREATE.execute({
        slug: 'old-slug',
        name: 'Test',
      }, ctx);

      const result = await PROJECT_UPDATE.execute({
        id: created.id,
        slug: 'new-slug',
      }, ctx);

      expect(result.slug).toBe('new-slug');
    });

    it('should update multiple fields', async () => {
      const created = await PROJECT_CREATE.execute({
        slug: 'multi-update',
        name: 'Original',
      }, ctx);

      const result = await PROJECT_UPDATE.execute({
        id: created.id,
        name: 'New Name',
        description: 'New Description',
      }, ctx);

      expect(result.name).toBe('New Name');
      expect(result.description).toBe('New Description');
    });
  });

  describe('PROJECT_DELETE', () => {
    it('should delete project', async () => {
      const created = await PROJECT_CREATE.execute({
        slug: 'to-delete',
        name: 'Delete Me',
      }, ctx);

      const result = await PROJECT_DELETE.execute({
        id: created.id,
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.id).toBe(created.id);

      // Verify it's deleted
      await expect(PROJECT_GET.execute({
        id: created.id,
      }, ctx)).rejects.toThrow('Project not found');
    });
  });
});

