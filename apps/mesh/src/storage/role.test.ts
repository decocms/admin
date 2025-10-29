import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabase, closeDatabase } from '../database';
import { createTestSchema } from './__test-helpers';
import { RoleStorage } from './role';
import type { Kysely } from 'kysely';
import type { Database } from './types';

describe('RoleStorage', () => {
  let db: Kysely<Database>;
  let storage: RoleStorage;

  beforeAll(async () => {
    const tempDbPath = `/tmp/test-role-${Date.now()}.db`;
    db = createDatabase(`file:${tempDbPath}`);
    storage = new RoleStorage(db);
    await createTestSchema(db);
  });

  afterAll(async () => {
    await closeDatabase(db);
  });

  describe('create', () => {
    it('should create role with permissions', async () => {
      const role = await storage.create({
        projectId: 'proj_123',
        name: 'Admin Role',
        description: 'Administrator role',
        permissions: {
          'mcp': ['PROJECT_CREATE', 'PROJECT_DELETE'],
          'conn_123': ['SEND_MESSAGE'],
        },
      });

      expect(role.id).toMatch(/^role_/);
      expect(role.name).toBe('Admin Role');
      expect(role.projectId).toBe('proj_123');
      expect(role.permissions).toEqual({
        'mcp': ['PROJECT_CREATE', 'PROJECT_DELETE'],
        'conn_123': ['SEND_MESSAGE'],
      });
    });

    it('should create role without description', async () => {
      const role = await storage.create({
        projectId: 'proj_123',
        name: 'Simple Role',
        permissions: {},
      });

      expect(role.description).toBeNull();
      expect(role.permissions).toEqual({});
    });
  });

  describe('findById', () => {
    it('should find role by ID', async () => {
      const created = await storage.create({
        projectId: 'proj_123',
        name: 'Find Me',
        permissions: { 'test': ['action'] },
      });

      const found = await storage.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Find Me');
    });

    it('should return null for non-existent ID', async () => {
      const found = await storage.findById('role_nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('should list roles for a project', async () => {
      await storage.create({
        projectId: 'proj_list',
        name: 'Role 1',
        permissions: {},
      });

      await storage.create({
        projectId: 'proj_list',
        name: 'Role 2',
        permissions: {},
      });

      const roles = await storage.list('proj_list');
      expect(roles.length).toBeGreaterThanOrEqual(2);
      expect(roles.every(r => r.projectId === 'proj_list')).toBe(true);
    });

    it('should return empty array for project with no roles', async () => {
      const roles = await storage.list('proj_empty');
      expect(roles).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update role name', async () => {
      const created = await storage.create({
        projectId: 'proj_123',
        name: 'Original',
        permissions: {},
      });

      const updated = await storage.update(created.id, {
        name: 'Updated',
      });

      expect(updated.name).toBe('Updated');
    });

    it('should update role permissions', async () => {
      const created = await storage.create({
        projectId: 'proj_123',
        name: 'Test',
        permissions: { 'old': ['action'] },
      });

      const updated = await storage.update(created.id, {
        permissions: { 'new': ['action'] },
      });

      expect(updated.permissions).toEqual({ 'new': ['action'] });
    });
  });

  describe('delete', () => {
    it('should delete role', async () => {
      const created = await storage.create({
        projectId: 'proj_123',
        name: 'Delete Me',
        permissions: {},
      });

      await storage.delete(created.id);

      const found = await storage.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('permissions deserialization', () => {
    it('should deserialize permissions correctly', async () => {
      const role = await storage.create({
        projectId: 'proj_123',
        name: 'Complex Permissions',
        permissions: {
          'mcp': ['PROJECT_CREATE', 'PROJECT_LIST'],
          'conn_abc': ['SEND_MESSAGE', 'LIST_THREADS'],
          'conn_xyz': ['*'],
        },
      });

      const found = await storage.findById(role.id);
      expect(found?.permissions).toEqual({
        'mcp': ['PROJECT_CREATE', 'PROJECT_LIST'],
        'conn_abc': ['SEND_MESSAGE', 'LIST_THREADS'],
        'conn_xyz': ['*'],
      });
    });
  });
});

