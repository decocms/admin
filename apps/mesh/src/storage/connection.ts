/**
 * Connection Storage Implementation
 * 
 * Handles CRUD operations for MCP connections using Kysely (database-agnostic).
 * All connections are organization-scoped.
 */

import type { Kysely } from 'kysely';
import { nanoid } from 'nanoid';
import type { ConnectionStoragePort, CreateConnectionData, UpdateConnectionData } from './ports';
import type { Database, MCPConnection } from './types';

export class ConnectionStorage implements ConnectionStoragePort {
  constructor(private db: Kysely<Database>) { }

  async create(data: CreateConnectionData): Promise<MCPConnection> {
    const id = `conn_${nanoid()}`;

    // Insert the connection
    await this.db
      .insertInto('connections')
      .values({
        id,
        organizationId: data.organizationId,
        createdById: data.createdById,
        name: data.name,
        description: data.description ?? null,
        icon: data.icon ?? null,
        appName: data.appName ?? null,
        appId: data.appId ?? null,

        // Connection details
        connectionType: data.connection.type,
        connectionUrl: data.connection.url,
        connectionToken: data.connection.token ?? null,
        connectionHeaders: data.connection.headers
          ? JSON.stringify(data.connection.headers)
          : null,

        // OAuth config
        oauthConfig: data.oauthConfig
          ? JSON.stringify(data.oauthConfig)
          : null,

        metadata: data.metadata
          ? JSON.stringify(data.metadata)
          : null,

        tools: null, // Populated later via discovery
        bindings: null, // Populated later via binding detection

        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .execute();

    // Fetch the created connection
    const connection = await this.findById(id);
    if (!connection) {
      throw new Error(`Failed to create connection with id: ${id}`);
    }

    return connection;
  }

  async findById(id: string): Promise<MCPConnection | null> {
    const connection = await this.db
      .selectFrom('connections')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return connection ? this.deserializeConnection(connection) : null;
  }

  async list(organizationId: string): Promise<MCPConnection[]> {
    const connections = await this.db
      .selectFrom('connections')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .execute();

    return connections.map((c) => this.deserializeConnection(c));
  }

  async update(id: string, data: UpdateConnectionData): Promise<MCPConnection> {
    // Prepare update data with proper JSON serialization
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.connectionToken !== undefined) updateData.connectionToken = data.connectionToken;

    // Serialize JSON fields
    if (data.metadata !== undefined) {
      updateData.metadata = JSON.stringify(data.metadata);
    }
    if (data.tools !== undefined) {
      updateData.tools = JSON.stringify(data.tools);
    }
    if (data.bindings !== undefined) {
      updateData.bindings = JSON.stringify(data.bindings);
    }

    await this.db
      .updateTable('connections')
      .set(updateData)
      .where('id', '=', id)
      .execute();

    // Fetch the updated connection
    const connection = await this.findById(id);
    if (!connection) {
      throw new Error('Connection not found after update');
    }

    return connection;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .deleteFrom('connections')
      .where('id', '=', id)
      .execute();
  }

  async testConnection(id: string): Promise<{ healthy: boolean; latencyMs: number }> {
    const connection = await this.findById(id);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const startTime = Date.now();

    try {
      // Simple health check - try to reach the URL
      const response = await fetch(connection.connectionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(connection.connectionToken && {
            Authorization: `Bearer ${connection.connectionToken}`,
          }),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'ping',
          id: 1,
        }),
      });

      const latencyMs = Date.now() - startTime;

      return {
        healthy: response.ok || response.status === 404, // 404 is ok (service exists)
        latencyMs,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Deserialize JSON fields from database
   */
  private deserializeConnection(raw: any): MCPConnection {
    return {
      ...raw,
      connectionHeaders: raw.connectionHeaders
        ? JSON.parse(raw.connectionHeaders)
        : null,
      oauthConfig: raw.oauthConfig
        ? JSON.parse(raw.oauthConfig)
        : null,
      metadata: raw.metadata
        ? JSON.parse(raw.metadata)
        : null,
      tools: raw.tools
        ? JSON.parse(raw.tools)
        : null,
      bindings: raw.bindings
        ? JSON.parse(raw.bindings)
        : null,
    };
  }
}

