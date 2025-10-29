import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabase, closeDatabase } from '../../database';
import { createTestSchema } from '../../storage/__test-helpers';
import { CONNECTION_CREATE, CONNECTION_LIST, CONNECTION_GET, CONNECTION_DELETE, CONNECTION_TEST } from './index';
import type { Kysely } from 'kysely';
import type { Database } from '../../storage/types';
import type { MeshContext } from '../../core/mesh-context';
import { ConnectionStorage } from '../../storage/connection';
import { ProjectStorage } from '../../storage/project';

describe('Connection Tools', () => {
  let db: Kysely<Database>;
  let ctx: MeshContext;

  beforeAll(async () => {
    const tempDbPath = `/tmp/test-connection-tools-${Date.now()}.db`;
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

  describe('CONNECTION_CREATE', () => {
    it('should create organization-scoped connection', async () => {
      const result = await CONNECTION_CREATE.execute({
        name: 'Company Slack',
        description: 'Organization-wide Slack',
        projectId: null, // Organization-scoped
        connection: {
          type: 'HTTP',
          url: 'https://slack.com/mcp',
          token: 'slack-token',
        },
      }, ctx);

      expect(result.id).toMatch(/^conn_/);
      expect(result.name).toBe('Company Slack');
      expect(result.scope).toBe('organization');
      expect(result.status).toBe('active');
    });

    it('should create project-scoped connection', async () => {
      const result = await CONNECTION_CREATE.execute({
        name: 'Project DB',
        projectId: 'proj_abc',
        connection: {
          type: 'HTTP',
          url: 'https://db.com/mcp',
        },
      }, ctx);

      expect(result.scope).toBe('project');
    });

    it('should support different connection types', async () => {
      const httpResult = await CONNECTION_CREATE.execute({
        name: 'HTTP Connection',
        connection: { type: 'HTTP', url: 'https://http.com' },
      }, ctx);
      expect(httpResult.id).toBeDefined();

      const sseResult = await CONNECTION_CREATE.execute({
        name: 'SSE Connection',
        connection: {
          type: 'SSE',
          url: 'https://sse.com',
          headers: { 'X-Custom': 'value' },
        },
      }, ctx);
      expect(sseResult.id).toBeDefined();

      const wsResult = await CONNECTION_CREATE.execute({
        name: 'WS Connection',
        connection: { type: 'Websocket', url: 'wss://ws.com' },
      }, ctx);
      expect(wsResult.id).toBeDefined();
    });
  });

  describe('CONNECTION_LIST', () => {
    beforeAll(async () => {
      // Create some test connections
      await CONNECTION_CREATE.execute({
        name: 'Org Connection 1',
        projectId: null,
        connection: { type: 'HTTP', url: 'https://org1.com' },
      }, ctx);

      await CONNECTION_CREATE.execute({
        name: 'Project Connection 1',
        projectId: 'proj_test',
        connection: { type: 'HTTP', url: 'https://proj1.com' },
      }, ctx);
    });

    it('should list all connections', async () => {
      const result = await CONNECTION_LIST.execute({
        scope: 'all',
      }, ctx);

      expect(result.connections.length).toBeGreaterThan(0);
    });

    it('should filter by scope', async () => {
      const orgResult = await CONNECTION_LIST.execute({
        scope: 'organization',
      }, ctx);

      expect(orgResult.connections.every(c => c.scope === 'organization')).toBe(true);
    });

    it('should include connection details', async () => {
      const result = await CONNECTION_LIST.execute({
        scope: 'all',
      }, ctx);

      const conn = result.connections[0];
      expect(conn).toHaveProperty('id');
      expect(conn).toHaveProperty('name');
      expect(conn).toHaveProperty('connectionType');
      expect(conn).toHaveProperty('connectionUrl');
      expect(conn).toHaveProperty('status');
    });
  });

  describe('CONNECTION_GET', () => {
    it('should get connection by ID', async () => {
      const created = await CONNECTION_CREATE.execute({
        name: 'Get Test',
        connection: { type: 'HTTP', url: 'https://test.com' },
      }, ctx);

      const result = await CONNECTION_GET.execute({
        id: created.id,
      }, ctx);

      expect(result.id).toBe(created.id);
      expect(result.name).toBe('Get Test');
    });

    it('should throw when connection not found', async () => {
      await expect(CONNECTION_GET.execute({
        id: 'conn_nonexistent',
      }, ctx)).rejects.toThrow('Connection not found');
    });
  });

  describe('CONNECTION_DELETE', () => {
    it('should delete connection', async () => {
      const created = await CONNECTION_CREATE.execute({
        name: 'To Delete',
        connection: { type: 'HTTP', url: 'https://delete.com' },
      }, ctx);

      const result = await CONNECTION_DELETE.execute({
        id: created.id,
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.id).toBe(created.id);

      // Verify it's deleted
      await expect(CONNECTION_GET.execute({
        id: created.id,
      }, ctx)).rejects.toThrow('Connection not found');
    });
  });

  describe('CONNECTION_TEST', () => {
    it('should test connection health', async () => {
      const created = await CONNECTION_CREATE.execute({
        name: 'Test Health',
        connection: {
          type: 'HTTP',
          url: 'https://this-will-fail.invalid',
        },
      }, ctx);

      const result = await CONNECTION_TEST.execute({
        id: created.id,
      }, ctx);

      expect(result.id).toBe(created.id);
      expect(result).toHaveProperty('healthy');
      expect(result).toHaveProperty('latencyMs');
      expect(typeof result.latencyMs).toBe('number');
    });

    it('should throw when connection not found', async () => {
      await expect(CONNECTION_TEST.execute({
        id: 'conn_nonexistent',
      }, ctx)).rejects.toThrow('Connection not found');
    });
  });
});

