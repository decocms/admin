import { and, eq } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { AppContext } from "../context";
import { relations } from "../relations";
import { projectSecrets, projectSecretsAuditLog } from "../schema";
import { getProjectIdFromContext } from "../projects/util";

export interface SecretsVault {
  readSecret(
    name: string,
  ): Promise<{ id: string; value: string; projectId: string }>;
  updateSecret(secretId: string, value: string): Promise<void>;
  logAccess(params: {
    secretId: string | null;
    secretName: string;
    projectId: string;
    accessedBy: string | null;
    accessType: "read" | "create" | "update" | "delete";
    toolName?: string;
    agentId?: string;
  }): Promise<void>;
}

export class SupabaseSecretsVault implements SecretsVault {
  private encryptionKey: Buffer;
  private ivLength = 16; // AES block size
  private drizzle: PostgresJsDatabase<
    Record<string, unknown>,
    typeof relations
  >;
  private ctx: AppContext;

  constructor(c: AppContext) {
    const encryptionKey = c.envVars.LLMS_ENCRYPTION_KEY;
    if (
      !encryptionKey ||
      typeof encryptionKey !== "string" ||
      encryptionKey.length !== 32
    ) {
      throw new Error("Encryption key must be 32 characters long for AES-256");
    }
    this.encryptionKey = Buffer.from(encryptionKey);
    this.drizzle = c.drizzle;
    this.ctx = c;
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv("aes-256-cbc", this.encryptionKey, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      this.encryptionKey,
      iv,
    );
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  async readSecret(
    name: string,
  ): Promise<{ id: string; value: string; projectId: string }> {
    const projectId = await getProjectIdFromContext(this.ctx);
    if (!projectId) {
      throw new Error("Project ID is required");
    }

    const [data] = await this.drizzle
      .select({
        id: projectSecrets.id,
        name: projectSecrets.name,
        valueEncrypted: projectSecrets.value_encrypted,
        projectId: projectSecrets.project_id,
      })
      .from(projectSecrets)
      .where(
        and(
          eq(projectSecrets.name, name),
          eq(projectSecrets.project_id, projectId),
        ),
      )
      .limit(1);

    if (!data) {
      throw new Error(`Secret "${name}" not found`);
    }

    if (!data.valueEncrypted) {
      throw new Error(`Secret "${name}" does not have a value`);
    }

    return {
      id: data.id,
      value: this.decrypt(data.valueEncrypted),
      projectId: data.projectId,
    };
  }

  async updateSecret(secretId: string, value: string): Promise<void> {
    const projectId = await getProjectIdFromContext(this.ctx);
    if (!projectId) {
      throw new Error("Project ID is required");
    }

    const encryptedValue = this.encrypt(value);

    await this.drizzle
      .update(projectSecrets)
      .set({
        value_encrypted: encryptedValue,
        updated_at: new Date().toISOString(),
      })
      .where(
        and(
          eq(projectSecrets.id, secretId),
          eq(projectSecrets.project_id, projectId),
        ),
      );
  }

  async logAccess(params: {
    secretId: string | null;
    secretName: string;
    projectId: string;
    accessedBy: string | null;
    accessType: "read" | "create" | "update" | "delete";
    toolName?: string;
    agentId?: string;
  }): Promise<void> {
    await this.drizzle.insert(projectSecretsAuditLog).values({
      secret_id: params.secretId,
      secret_name: params.secretName,
      project_id: params.projectId,
      accessed_by: params.accessedBy,
      access_type: params.accessType,
      tool_name: params.toolName,
      agent_id: params.agentId,
    });
  }
}
