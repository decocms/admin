/**
 * Role Storage Implementation
 * 
 * Manages roles with permissions
 */

import type { Kysely } from 'kysely';
import { nanoid } from 'nanoid';
import type { Database, Role, Permission } from './types';

export interface CreateRoleData {
  projectId: string;
  name: string;
  description?: string;
  permissions: Permission;
}

export class RoleStorage {
  constructor(private db: Kysely<Database>) { }

  async create(data: CreateRoleData): Promise<Role> {
    const id = `role_${nanoid()}`;

    await this.db
      .insertInto('roles')
      .values({
        id,
        projectId: data.projectId,
        name: data.name,
        description: data.description ?? null,
        permissions: JSON.stringify(data.permissions),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .execute();

    const role = await this.findById(id);
    if (!role) {
      throw new Error('Failed to create role');
    }

    return role;
  }

  async findById(id: string): Promise<Role | null> {
    const role = await this.db
      .selectFrom('roles')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return role ? this.deserializeRole(role) : null;
  }

  async list(projectId: string): Promise<Role[]> {
    const roles = await this.db
      .selectFrom('roles')
      .selectAll()
      .where('projectId', '=', projectId)
      .execute();

    return roles.map(r => this.deserializeRole(r));
  }

  async update(id: string, data: Partial<CreateRoleData>): Promise<Role> {
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.permissions !== undefined) {
      updateData.permissions = JSON.stringify(data.permissions);
    }

    await this.db
      .updateTable('roles')
      .set(updateData)
      .where('id', '=', id)
      .execute();

    const role = await this.findById(id);
    if (!role) {
      throw new Error('Role not found after update');
    }

    return role;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .deleteFrom('roles')
      .where('id', '=', id)
      .execute();
  }

  private deserializeRole(raw: any): Role {
    return {
      ...raw,
      permissions: raw.permissions
        ? JSON.parse(raw.permissions)
        : {},
    };
  }
}

