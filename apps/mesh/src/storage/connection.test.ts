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
        organizationId: 'org_123',
        createdById: 'user_123',
        name: 'Company Slack',
        description: 'Slack for the organization',
        connection: {
          type: 'HTTP',
          url: 'https://slack.com/mcp',
          token: 'slack-token-123',
        },
      });

      expect(connection.id).toMatch(/^conn_/);
      expect(connection.organizationId).toBe('org_123');
      expect(connection.name).toBe('Company Slack');
      expect(connection.status).toBe('active');
      expect(connection.connectionType).toBe('HTTP');
      expect(connection.connectionUrl).toBe('https://slack.com/mcp');
    });

    it('should serialize connection headers as JSON', async () => {
      const connection = await storage.create({
        organizationId: 'org_123',
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
        organizationId: 'org_123',
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
        organizationId: 'org_123',
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
    it('should list all connections for an organization', async () => {
      await storage.create({
        organizationId: 'org_123',
        createdById: 'user_123',
        name: 'Slack',
        connection: { type: 'HTTP', url: 'https://slack.com' },
      });

      await storage.create({
        organizationId: 'org_123',
        createdById: 'user_123',
        name: 'Gmail',
        connection: { type: 'HTTP', url: 'https://gmail.com' },
      });

      const connections = await storage.list('org_123');
      expect(connections.length).toBeGreaterThanOrEqual(2);
      expect(connections.every(c => c.organizationId === 'org_123')).toBe(true);
    });

    it('should not list connections from other organizations', async () => {
      await storage.create({
        organizationId: 'org_456',
        createdById: 'user_123',
        name: 'Other Org',
        connection: { type: 'HTTP', url: 'https://other.com' },
      });

      const connections = await storage.list('org_123');
      expect(connections.every(c => c.organizationId === 'org_123')).toBe(true);
      expect(connections.some(c => c.organizationId === 'org_456')).toBe(false);
    });
  });

  describe('update', () => {
    it('should update connection name', async () => {
      const created = await storage.create({
        organizationId: 'org_123',
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
        organizationId: 'org_123',
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
        organizationId: 'org_123',
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
        organizationId: 'org_123',
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
        organizationId: 'org_123',
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
        organizationId: 'org_123',
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
        organizationId: 'org_123',
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

