# Task 04: Project Storage Implementation

## Overview
Implement ProjectStorage for managing projects (namespace-scoped resources in the organization).

## Dependencies
- `01-database-types.md` (needs Project interface)
- `02-database-factory.md` (needs Kysely instance)

## Context from Spec

Projects are like Kubernetes namespaces - they provide isolation within an organization (database). The database itself represents the organization boundary.

## Implementation Steps

### 1. Add to storage ports

**Location:** `apps/mesh/src/storage/ports.ts` (append)

```typescript
export interface CreateProjectData {
  slug: string; // URL-safe, unique
  name: string;
  description?: string;
  ownerId: string;
}

export interface ProjectStoragePort {
  create(data: CreateProjectData): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findBySlug(slug: string): Promise<Project | null>;
  list(userId?: string): Promise<Project[]>; // All projects or user's projects
  update(id: string, data: Partial<Project>): Promise<Project>;
  delete(id: string): Promise<void>;
}
```

### 2. Implement ProjectStorage

**Location:** `apps/mesh/src/storage/project.ts`

```typescript
import { Kysely } from 'kysely';
import type { Database, Project } from './types';
import type { ProjectStoragePort, CreateProjectData } from './ports';
import { nanoid } from 'nanoid';

export class ProjectStorage implements ProjectStoragePort {
  constructor(private db: Kysely<Database>) {}

  async create(data: CreateProjectData): Promise<Project> {
    const id = `proj_${nanoid()}`;
    
    return await this.db
      .insertInto('projects')
      .values({
        id,
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
        ownerId: data.ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<Project | null> {
    return await this.db
      .selectFrom('projects')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst() ?? null;
  }

  async findBySlug(slug: string): Promise<Project | null> {
    return await this.db
      .selectFrom('projects')
      .selectAll()
      .where('slug', '=', slug)
      .executeTakeFirst() ?? null;
  }

  async list(userId?: string): Promise<Project[]> {
    let query = this.db.selectFrom('projects').selectAll();
    
    if (userId) {
      // Filter by projects where user is owner or member
      query = query.where((eb) =>
        eb.or([
          eb('ownerId', '=', userId),
          eb.exists(
            eb.selectFrom('project_members')
              .select('id')
              .where('userId', '=', userId)
              .where('projectId', '=', eb.ref('projects.id'))
          ),
        ])
      );
    }
    
    return await query.execute();
  }

  async update(id: string, data: Partial<Project>): Promise<Project> {
    return await this.db
      .updateTable('projects')
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async delete(id: string): Promise<void> {
    await this.db
      .deleteFrom('projects')
      .where('id', '=', id)
      .execute();
  }
}
```

## Testing

Create `apps/mesh/src/storage/project.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabase, closeDatabase } from '../database';
import { ProjectStorage } from './project';
import type { Kysely } from 'kysely';
import type { Database } from './types';

describe('ProjectStorage', () => {
  let db: Kysely<Database>;
  let storage: ProjectStorage;

  beforeAll(async () => {
    db = createDatabase('file::memory:');
    storage = new ProjectStorage(db);
    // TODO: Run migrations when available
  });

  afterAll(async () => {
    await closeDatabase(db);
  });

  it('should create project', async () => {
    const project = await storage.create({
      slug: 'test-project',
      name: 'Test Project',
      description: 'A test project',
      ownerId: 'user_123',
    });

    expect(project.id).toMatch(/^proj_/);
    expect(project.slug).toBe('test-project');
    expect(project.name).toBe('Test Project');
  });

  it('should find project by ID', async () => {
    const created = await storage.create({
      slug: 'find-by-id',
      name: 'Find By ID',
      ownerId: 'user_123',
    });

    const found = await storage.findById(created.id);
    expect(found).not.toBeNull();
    expect(found?.slug).toBe('find-by-id');
  });

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

  it('should list all projects', async () => {
    const projects = await storage.list();
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
  });

  it('should update project', async () => {
    const created = await storage.create({
      slug: 'to-update',
      name: 'Original',
      ownerId: 'user_123',
    });

    const updated = await storage.update(created.id, {
      name: 'Updated',
      description: 'New description',
    });

    expect(updated.name).toBe('Updated');
    expect(updated.description).toBe('New description');
  });

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
});
```

## Validation

- [ ] Creates projects with unique IDs
- [ ] Finds projects by ID and slug
- [ ] Lists all projects
- [ ] Updates project fields
- [ ] Deletes projects
- [ ] Tests pass

## Reference

See spec: **Database Model** - Project interface (lines 3318-3327)

