import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDatabase, createDatabase } from '../database';
import { createTestSchema } from './__test-helpers';
import { ProjectStorage } from './project';
import type { Database } from './types';

describe('ProjectStorage', () => {
  let db: Kysely<Database>;
  let storage: ProjectStorage;

  beforeAll(async () => {
    const tempDbPath = `/tmp/test-project-${Date.now()}.db`;
    db = createDatabase(`file:${tempDbPath}`);
    storage = new ProjectStorage(db);
    await createTestSchema(db);
  });

  afterAll(async () => {
    await closeDatabase(db);
  });

  describe('create', () => {
    it('should create project with all fields', async () => {
      const project = await storage.create({
        slug: 'test-project',
        name: 'Test Project',
        description: 'A test project',
        ownerId: 'user_123',
      });

      expect(project.id).toMatch(/^proj_/);
      expect(project.slug).toBe('test-project');
      expect(project.name).toBe('Test Project');
      expect(project.description).toBe('A test project');
      expect(project.ownerId).toBe('user_123');
      expect(project.createdAt).toBeDefined();
      expect(project.updatedAt).toBeDefined();
    });

    it('should create project without description', async () => {
      const project = await storage.create({
        slug: 'minimal-project',
        name: 'Minimal',
        ownerId: 'user_123',
      });

      expect(project.id).toMatch(/^proj_/);
      expect(project.description).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find project by ID', async () => {
      const created = await storage.create({
        slug: 'find-by-id',
        name: 'Find By ID',
        ownerId: 'user_123',
      });

      const found = await storage.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.slug).toBe('find-by-id');
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await storage.findById('proj_nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findBySlug', () => {
    it('should find project by slug', async () => {
      await storage.create({
        slug: 'unique-slug',
        name: 'Unique',
        ownerId: 'user_123',
      });

      const found = await storage.findBySlug('unique-slug');
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Unique');
    });

    it('should return null for non-existent slug', async () => {
      const found = await storage.findBySlug('nonexistent-slug');
      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all projects when no userId provided', async () => {
      await storage.create({
        slug: 'list-test-1',
        name: 'List Test 1',
        ownerId: 'user_123',
      });

      await storage.create({
        slug: 'list-test-2',
        name: 'List Test 2',
        ownerId: 'user_456',
      });

      const projects = await storage.list();
      expect(projects.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter projects by userId (owner)', async () => {
      await storage.create({
        slug: 'user-a-project',
        name: 'User A Project',
        ownerId: 'user_a',
      });

      await storage.create({
        slug: 'user-b-project',
        name: 'User B Project',
        ownerId: 'user_b',
      });

      const userAProjects = await storage.list('user_a');
      expect(userAProjects.every(p => p.ownerId === 'user_a')).toBe(true);
      expect(userAProjects.some(p => p.slug === 'user-a-project')).toBe(true);
    });
  });

  describe('update', () => {
    it('should update project name', async () => {
      const created = await storage.create({
        slug: 'update-name',
        name: 'Original Name',
        ownerId: 'user_123',
      });

      const updated = await storage.update(created.id, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.slug).toBe('update-name'); // Unchanged
    });

    it('should update project description', async () => {
      const created = await storage.create({
        slug: 'update-desc',
        name: 'Test',
        ownerId: 'user_123',
      });

      const updated = await storage.update(created.id, {
        description: 'New description',
      });

      expect(updated.description).toBe('New description');
    });

    it('should update project slug', async () => {
      const created = await storage.create({
        slug: 'old-slug',
        name: 'Test',
        ownerId: 'user_123',
      });

      const updated = await storage.update(created.id, {
        slug: 'new-slug',
      });

      expect(updated.slug).toBe('new-slug');

      // Should be findable by new slug
      const found = await storage.findBySlug('new-slug');
      expect(found?.id).toBe(created.id);
    });

    it('should update multiple fields at once', async () => {
      const created = await storage.create({
        slug: 'multi-update',
        name: 'Original',
        ownerId: 'user_123',
      });

      const updated = await storage.update(created.id, {
        name: 'New Name',
        description: 'New Description',
      });

      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('New Description');
    });
  });

  describe('delete', () => {
    it('should delete project', async () => {
      const created = await storage.create({
        slug: 'to-delete',
        name: 'Delete Me',
        ownerId: 'user_123',
      });

      await storage.delete(created.id);

      const found = await storage.findById(created.id);
      expect(found).toBeNull();
    });

    it('should not throw when deleting non-existent project', async () => {
      // Should succeed silently
      await storage.delete('proj_nonexistent');
      expect(true).toBe(true);
    });
  });
});

