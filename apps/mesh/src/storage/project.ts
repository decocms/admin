/**
 * Project Storage Implementation
 * 
 * Projects are namespace-scoped resources within an organization (database).
 * They provide isolation for resources but not users.
 */

import type { Kysely } from 'kysely';
import { nanoid } from 'nanoid';
import type { CreateProjectData, ProjectStoragePort } from './ports';
import type { Database, Project } from './types';

export class ProjectStorage implements ProjectStoragePort {
  constructor(private db: Kysely<Database>) { }

  async create(data: CreateProjectData): Promise<Project> {
    const id = `proj_${nanoid()}`;

    await this.db
      .insertInto('projects')
      .values({
        id,
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
        ownerId: data.ownerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .execute();

    const project = await this.findById(id);
    if (!project) {
      throw new Error('Failed to create project');
    }

    return project;
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
      // Filter by projects where user is owner
      // Note: We removed ProjectMember table as users don't have explicit project membership
      // Access control is via roles and permissions, not membership
      query = query.where('ownerId', '=', userId);
    }

    return await query.execute();
  }

  async update(id: string, data: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Project> {
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;

    await this.db
      .updateTable('projects')
      .set(updateData)
      .where('id', '=', id)
      .execute();

    const project = await this.findById(id);
    if (!project) {
      throw new Error('Project not found after update');
    }

    return project;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .deleteFrom('projects')
      .where('id', '=', id)
      .execute();
  }
}

