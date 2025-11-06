/**
 * Connection Storage Implementation
 *
 * Handles CRUD operations for MCP connections using Kysely (database-agnostic).
 * All connections are organization-scoped.
 */

import type { Kysely } from "kysely";
import { nanoid } from "nanoid";
import type { CredentialVault } from "../encryption/credential-vault";
import type {
  ConnectionStoragePort,
  CreateConnectionData,
  UpdateConnectionData,
} from "./ports";
import type { Database, MCPConnection, ToolDefinition } from "./types";

export class ConnectionStorage implements ConnectionStoragePort {
  constructor(
    private db: Kysely<Database>,
    private vault: CredentialVault,
  ) {}

  async create(data: CreateConnectionData): Promise<MCPConnection> {
    const id = `conn_${nanoid()}`;

    // Encrypt token if provided
    let encryptedToken: string | null = null;
    if (data.connection.token) {
      encryptedToken = await this.vault.encrypt(data.connection.token);
    }

    // Insert the connection
    await this.db
      .insertInto("connections")
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
        connectionToken: encryptedToken,
        connectionHeaders: data.connection.headers
          ? JSON.stringify(data.connection.headers)
          : null,

        // OAuth config
        oauthConfig: data.oauthConfig ? JSON.stringify(data.oauthConfig) : null,

        metadata: data.metadata ? JSON.stringify(data.metadata) : null,

        tools: null, // Populated later via discovery
        bindings: null, // Populated later via binding detection

        status: "active",
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
      .selectFrom("connections")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return connection
      ? await this.deserializeConnection(
          connection as Parameters<typeof this.deserializeConnection>[0],
        )
      : null;
  }

  async list(organizationId: string): Promise<MCPConnection[]> {
    const connections = await this.db
      .selectFrom("connections")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .execute();

    return await Promise.all(
      connections.map((c) =>
        this.deserializeConnection(
          c as Parameters<typeof this.deserializeConnection>[0],
        ),
      ),
    );
  }

  async update(id: string, data: UpdateConnectionData): Promise<MCPConnection> {
    // Prepare update data with proper JSON serialization
    const updateData: Partial<{
      name: string;
      description: string;
      icon: string;
      status: "active" | "inactive" | "error";
      connectionToken: string;
      metadata: string;
      tools: string;
      bindings: string;
      updatedAt: string;
    }> = {
      updatedAt: new Date().toISOString(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.connectionToken !== undefined) {
      // Encrypt token before storing
      updateData.connectionToken = await this.vault.encrypt(
        data.connectionToken,
      );
    }

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
      .updateTable("connections")
      .set(updateData)
      .where("id", "=", id)
      .execute();

    // Fetch the updated connection
    const connection = await this.findById(id);
    if (!connection) {
      throw new Error("Connection not found after update");
    }

    return connection;
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteFrom("connections").where("id", "=", id).execute();
  }

  async testConnection(
    id: string,
  ): Promise<{ healthy: boolean; latencyMs: number }> {
    const connection = await this.findById(id);
    if (!connection) {
      throw new Error("Connection not found");
    }

    const startTime = Date.now();

    try {
      // Simple health check - try to reach the URL
      const response = await fetch(connection.connectionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(connection.connectionToken && {
            Authorization: `Bearer ${connection.connectionToken}`,
          }),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "ping",
          id: 1,
        }),
      });

      const latencyMs = Date.now() - startTime;

      return {
        healthy: response.ok || response.status === 404, // 404 is ok (service exists)
        latencyMs,
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Deserialize JSON fields from database and decrypt token
   * Kysely automatically deserializes JSON columns on SELECT
   */
  private async deserializeConnection(raw: {
    id: string;
    organizationId: string;
    createdById: string;
    name: string;
    description: string | null;
    icon: string | null;
    appName: string | null;
    appId: string | null;
    connectionType: "HTTP" | "SSE" | "Websocket";
    connectionUrl: string;
    connectionToken: string | null;
    connectionHeaders: Record<string, string> | null;
    oauthConfig: unknown;
    metadata: Record<string, unknown> | null;
    tools: ToolDefinition[] | null;
    bindings: string[] | null;
    status: "active" | "inactive" | "error";
    createdAt: Date;
    updatedAt: Date;
  }): Promise<MCPConnection> {
    // Decrypt token if present
    let decryptedToken: string | null = null;
    if (raw.connectionToken) {
      try {
        decryptedToken = await this.vault.decrypt(raw.connectionToken);
      } catch (error) {
        console.error("Failed to decrypt connection token:", error);
        // Keep token encrypted if decryption fails (should not happen in production)
        decryptedToken = null;
      }
    }

    return {
      id: raw.id,
      organizationId: raw.organizationId,
      createdById: raw.createdById,
      name: raw.name,
      description: raw.description,
      icon: raw.icon,
      appName: raw.appName,
      appId: raw.appId,
      connectionType: raw.connectionType,
      connectionUrl: raw.connectionUrl,
      connectionToken: decryptedToken,
      connectionHeaders: raw.connectionHeaders,
      oauthConfig: raw.oauthConfig as MCPConnection["oauthConfig"],
      metadata: raw.metadata,
      tools: raw.tools,
      bindings: raw.bindings,
      status: raw.status,
      createdAt: raw.createdAt as Date | string,
      updatedAt: raw.updatedAt as Date | string,
    };
  }
}
