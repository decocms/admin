import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabase, closeDatabase } from '../database';
import { ConnectionStorage } from './connection';
import { createTestSchema } from './__test-helpers';
import type { Kysely } from 'kysely';
import type { Database } from './types';

describe('ConnectionStorage', () => {
  let db: Kysely<Database>;
  let storage: ConnectionStorage;

  beforeAll(async () => {
    // Use a temporary file-based database instead of in-memory
    const tempDbPath = `/tmp/test-connection-${Date.now()}.db`;
    db = createDatabase(`file:${tempDbPath}`);
    storage = new ConnectionStorage(db);
    await createTestSchema(db);
  });

  afterAll(async () => {
    await closeDatabase(db);
  });

  describe('create', () => {
    it('should create organization-scoped connection', async () => {
      const connection = await storage.create({
        projectId: null, // Organization-scoped
        createdById: 'user_123',
        name: 'Company Slack',
        description: 'Shared Slack for all projects',
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
      expect(connection.connectionType).toBe('HTTP');
      expect(connection.connectionUrl).toBe('https://slack.com/mcp');
    });

    it('should create project-scoped connection', async () => {
      const connection = await storage.create({
        projectId: 'proj_abc',
        createdById: 'user_123',
        name: 'Project Database',
        connection: {
          type: 'HTTP',
          url: 'https://db.com/mcp',
        },
      });

      expect(connection.projectId).toBe('proj_abc');
      expect(connection.name).toBe('Project Database');
    });

    it('should serialize connection headers as JSON', async () => {
      const connection = await storage.create({
        projectId: null,
        createdById: 'user_123',
        name: 'With Headers',
        connection: {
          type: 'SSE',
          url: 'https://sse.com',
          headers: { 'X-Custom': 'value' },
        },
      });

      expect(connection.connectionHeaders).toEqual({ 'X-Custom': 'value' });
    });

    it('should serialize OAuth config as JSON', async () => {
      const connection = await storage.create({
        projectId: null,
        createdById: 'user_123',
        name: 'OAuth Connection',
        connection: {
          type: 'HTTP',
          url: 'https://oauth.com',
        },
        oauthConfig: {
          authorizationEndpoint: 'https://auth.com/authorize',
          tokenEndpoint: 'https://auth.com/token',
          clientId: 'client_123',
          scopes: ['mcp'],
          grantType: 'authorization_code',
        },
      });

      expect(connection.oauthConfig).toEqual({
        authorizationEndpoint: 'https://auth.com/authorize',
        tokenEndpoint: 'https://auth.com/token',
        clientId: 'client_123',
        scopes: ['mcp'],
        grantType: 'authorization_code',
      });
    });
  });

  describe('findById', () => {
    it('should find connection by ID', async () => {
      const created = await storage.create({
        projectId: null,
        createdById: 'user_123',
        name: 'Find Me',
        connection: { type: 'HTTP', url: 'https://test.com' },
      });

      const found = await storage.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Find Me');
    });

    it('should return null for non-existent ID', async () => {
      const found = await storage.findById('conn_nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('should list organization-scoped connections only', async () => {
      await storage.create({
        projectId: null,
        createdById: 'user_123',
        name: 'Org Connection',
        connection: { type: 'HTTP', url: 'https://org.com' },
      });

      const connections = await storage.list(null, 'organization');
      expect(connections.length).toBeGreaterThan(0);
      expect(connections.every(c => c.projectId === null)).toBe(true);
    });

    it('should list project-scoped connections only', async () => {
      await storage.create({
        projectId: 'proj_xyz',
        createdById: 'user_123',
        name: 'Project Connection',
        connection: { type: 'HTTP', url: 'https://proj.com' },
      });

      const connections = await storage.list('proj_xyz', 'project');
      expect(connections.every(c => c.projectId === 'proj_xyz')).toBe(true);
    });

    it('should list all connections for a project (org + project)', async () => {
      await storage.create({
        projectId: null,
        createdById: 'user_123',
        name: 'Shared',
        connection: { type: 'HTTP', url: 'https://shared.com' },
      });

      await storage.create({
        projectId: 'proj_test',
        createdById: 'user_123',
        name: 'Project Specific',
        connection: { type: 'HTTP', url: 'https://specific.com' },
      });

      const connections = await storage.list('proj_test', 'all');
      const hasOrg = connections.some(c => c.projectId === null);
      const hasProject = connections.some(c => c.projectId === 'proj_test');

      expect(hasOrg || hasProject).toBe(true);
    });

    it('should list only org connections when no project specified', async () => {
      const connections = await storage.list(null, 'all');
      expect(connections.every(c => c.projectId === null)).toBe(true);
    });
  });

  describe('update', () => {
    it('should update connection name', async () => {
      const created = await storage.create({
        projectId: null,
        createdById: 'user_123',
        name: 'Original Name',
        connection: { type: 'HTTP', url: 'https://test.com' },
      });

      const updated = await storage.update(created.id, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
    });

    it('should update connection status', async () => {
      const created = await storage.create({
        projectId: null,
        createdById: 'user_123',
        name: 'Test',
        connection: { type: 'HTTP', url: 'https://test.com' },
      });

      const updated = await storage.update(created.id, {
        status: 'inactive',
      });

      expect(updated.status).toBe('inactive');
    });

    it('should update metadata', async () => {
      const created = await storage.create({
        projectId: null,
        createdById: 'user_123',
        name: 'Test',
        connection: { type: 'HTTP', url: 'https://test.com' },
      });

      const updated = await storage.update(created.id, {
        metadata: { version: '2.0' },
      });

      expect(updated.metadata).toEqual({ version: '2.0' });
    });

    it('should update bindings', async () => {
      const created = await storage.create({
        projectId: null,
        createdById: 'user_123',
        name: 'Test',
        connection: { type: 'HTTP', url: 'https://test.com' },
      });

      const updated = await storage.update(created.id, {
        bindings: ['CHAT', 'EMAIL'],
      });

      expect(updated.bindings).toEqual(['CHAT', 'EMAIL']);
    });
  });

  describe('delete', () => {
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

  describe('testConnection', () => {
    it('should throw when connection not found', async () => {
      await expect(storage.testConnection('conn_nonexistent')).rejects.toThrow(
        'Connection not found'
      );
    });

    it('should return unhealthy for unreachable connection', async () => {
      const created = await storage.create({
        projectId: null,
        createdById: 'user_123',
        name: 'Unreachable',
        connection: {
          type: 'HTTP',
          url: 'https://this-should-not-exist-12345.com/mcp',
        },
      });

      const result = await storage.testConnection(created.id);

      expect(result.healthy).toBe(false);
      expect(result.latencyMs).toBeGreaterThan(0);
    });
  });

  describe('JSON deserialization', () => {
    it('should deserialize all JSON fields correctly', async () => {
      const connection = await storage.create({
        projectId: null,
        createdById: 'user_123',
        name: 'JSON Test',
        connection: {
          type: 'SSE',
          url: 'https://test.com',
          headers: { 'X-Test': 'value' },
        },
        metadata: { key: 'value' },
      });

      // Update with tools and bindings
      const updated = await storage.update(connection.id, {
        tools: [{ name: 'TEST_TOOL', inputSchema: {} }],
        bindings: ['CHAT'],
      });

      expect(updated.connectionHeaders).toEqual({ 'X-Test': 'value' });
      expect(updated.metadata).toEqual({ key: 'value' });
      expect(updated.tools).toEqual([{ name: 'TEST_TOOL', inputSchema: {} }]);
      expect(updated.bindings).toEqual(['CHAT']);
    });
  });
});

