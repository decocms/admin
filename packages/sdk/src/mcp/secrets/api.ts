import { z } from "zod/v3";
import {
  assertHasWorkspace,
  assertHasLocator,
  assertWorkspaceResourceAccess,
} from "../assertions";
import { createToolGroup } from "../context";
import { SupabaseSecretsVault } from "./secrets-vault";
import { projectSecrets } from "../schema";
import { getProjectIdFromContext } from "../projects/util";
import { and, eq } from "drizzle-orm";

interface SecretRow {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

const formatSecretRow = (secret: SecretRow) => ({
  id: secret.id,
  name: secret.name,
  description: secret.description ?? undefined,
  createdAt: secret.created_at,
  updatedAt: secret.updated_at,
});

const createTool = createToolGroup("Secrets", {
  name: "Project Secrets Management",
  description: "Securely manage project secrets (API keys, tokens, etc.)",
  icon: "https://assets.decocache.com/mcp/8d655881-941f-4b5b-8c30-5cf80bd00c9e/Secrets-Management.png",
});

// SECRETS_LIST
const listSecretsSchema = z.object({});

export type ListSecretsInput = z.infer<typeof listSecretsSchema>;

export const listSecrets = createTool({
  name: "SECRETS_LIST",
  description:
    "List all secrets for the current project (metadata only, no values)",
  inputSchema: z.lazy(() => listSecretsSchema),
  outputSchema: z.lazy(() =>
    z.object({
      items: z.array(z.any()),
    }),
  ),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);

    // Get project ID from context
    const projectId = await getProjectIdFromContext(c);
    if (!projectId) {
      throw new Error("Project ID is required");
    }

    const secrets = await c.drizzle
      .select({
        id: projectSecrets.id,
        name: projectSecrets.name,
        description: projectSecrets.description,
        created_at: projectSecrets.created_at,
        updated_at: projectSecrets.updated_at,
      })
      .from(projectSecrets)
      .where(eq(projectSecrets.project_id, projectId));

    return { items: secrets.map(formatSecretRow) };
  },
});

// SECRETS_READ
const readSecretSchema = z.object({
  name: z.string().describe("The name of the secret to read"),
});

export type ReadSecretInput = z.infer<typeof readSecretSchema>;

export const readSecret = createTool({
  name: "SECRETS_READ",
  description: "Read a secret's decrypted value by name",
  inputSchema: z.lazy(() => readSecretSchema),
  outputSchema: z.lazy(() =>
    z.object({
      name: z.string(),
      value: z.string(),
    }),
  ),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);

    const { name } = props;
    const vault = new SupabaseSecretsVault(c);

    const { id, value, projectId } = await vault.readSecret(name);

    // Log access in background -- swallow logging errors instead of disrupting secret read
    try {
      const logPromise = vault.logAccess({
        secretId: id,
        secretName: name,
        projectId: projectId,
        accessedBy: (c.user?.id as string) || null,
        accessType: "read",
      });

      // Use waitUntil if available for background logging
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(logPromise);
      } else {
        await logPromise;
      }
    } catch (err) {
      // Logging failure is non-fatal -- do not disrupt secret read
      console.error("[SECRETS_READ] Failed to log secret access:", err);
    }

    return { name, value };
  },
});

// SECRETS_CREATE
const createSecretSchema = z.object({
  name: z
    .string()
    .regex(
      /^[A-Z0-9_]+$/,
      "Secret name must be uppercase alphanumeric with underscores only",
    )
    .describe("The name of the secret (e.g., STRIPE_API_KEY)"),
  value: z.string().describe("The secret value to encrypt and store"),
  description: z
    .string()
    .optional()
    .describe("Optional description of the secret"),
});

export type CreateSecretInput = z.infer<typeof createSecretSchema>;

export const createSecret = createTool({
  name: "SECRETS_CREATE",
  description: "Create a new secret",
  inputSchema: z.lazy(() => createSecretSchema),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);

    const { name, value, description } = props;
    const projectId = await getProjectIdFromContext(c);

    if (!projectId) {
      throw new Error("Project ID is required to create secrets");
    }

    const vault = new SupabaseSecretsVault(c);
    const encryptedValue = vault.encrypt(value);

    const [data] = await c.drizzle
      .insert(projectSecrets)
      .values({
        name,
        value_encrypted: encryptedValue,
        description: description ?? null,
        project_id: projectId,
      })
      .returning();

    if (!data) throw new Error("Failed to create secret");

    // Log creation -- swallow logging errors instead of disrupting secret creation, but log them
    try {
      const logPromise = vault.logAccess({
        secretId: data.id,
        secretName: name,
        projectId: projectId,
        accessedBy: (c.user?.id as string) || null,
        accessType: "create",
      });

      // Use waitUntil if available for background logging
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(logPromise);
      } else {
        await logPromise;
      }
    } catch (err) {
      // Logging failure is non-fatal -- do not disrupt secret creation
      // But do log the error for diagnostics
      console.error("[SECRETS_CREATE] Failed to log secret access:", err);
    }

    return formatSecretRow(data);
  },
});

// SECRETS_UPDATE
const updateSecretSchema = z.object({
  id: z.string().describe("The ID of the secret to update"),
  data: z.object({
    name: z
      .string()
      .regex(
        /^[A-Z0-9_]+$/,
        "Secret name must be uppercase alphanumeric with underscores only",
      )
      .optional(),
    value: z.string().optional(),
    description: z.string().nullable().optional(),
  }),
});

export type UpdateSecretInput = z.infer<typeof updateSecretSchema>;

export const updateSecret = createTool({
  name: "SECRETS_UPDATE",
  description: "Update an existing secret",
  inputSchema: z.lazy(() => updateSecretSchema),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);

    const { id, data: secretData } = props;
    const vault = new SupabaseSecretsVault(c);

    // Get project ID from context
    const projectId = await getProjectIdFromContext(c);
    if (!projectId) {
      throw new Error("Project ID is required");
    }

    // Get existing secret for name and project_id
    const [existing] = await c.drizzle
      .select()
      .from(projectSecrets)
      .where(
        and(
          eq(projectSecrets.id, id),
          eq(projectSecrets.project_id, projectId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error("Secret not found");
    }

    const updateData: Partial<typeof projectSecrets.$inferSelect> = {
      updated_at: new Date().toISOString(),
    };

    if (secretData.name !== undefined) {
      updateData.name = secretData.name;
    }

    if (secretData.value !== undefined) {
      const encryptedValue = vault.encrypt(secretData.value);
      updateData.value_encrypted = encryptedValue;
    }

    if (secretData.description !== undefined) {
      updateData.description = secretData.description;
    }

    const [updated] = await c.drizzle
      .update(projectSecrets)
      .set(updateData)
      .where(
        and(
          eq(projectSecrets.id, id),
          eq(projectSecrets.project_id, projectId),
        ),
      )
      .returning();

    if (!updated) throw new Error("Failed to update secret");

    // Log update -- swallow logging errors instead of disrupting secret update
    try {
      const logPromise = vault.logAccess({
        secretId: id,
        secretName: updated.name,
        projectId: existing.project_id,
        accessedBy: (c.user?.id as string) || null,
        accessType: "update",
      });

      // Use waitUntil if available for background logging
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(logPromise);
      } else {
        await logPromise;
      }
    } catch (err) {
      // Logging failure is non-fatal -- do not disrupt secret update
      console.error("[SECRETS_UPDATE] Failed to log secret access:", err);
    }

    return formatSecretRow(updated);
  },
});

// SECRETS_DELETE
const deleteSecretSchema = z.object({
  id: z.string().describe("The ID of the secret to delete"),
});

export type DeleteSecretInput = z.infer<typeof deleteSecretSchema>;

export const deleteSecret = createTool({
  name: "SECRETS_DELETE",
  description: "Delete a secret",
  inputSchema: z.lazy(() => deleteSecretSchema),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);

    const { id } = props;
    const vault = new SupabaseSecretsVault(c);

    // Get project ID from context
    const projectId = await getProjectIdFromContext(c);
    if (!projectId) {
      throw new Error("Project ID is required");
    }

    // Get secret details before deleting for audit log
    const [existing] = await c.drizzle
      .select()
      .from(projectSecrets)
      .where(
        and(
          eq(projectSecrets.id, id),
          eq(projectSecrets.project_id, projectId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error("Secret not found");
    }

    await c.drizzle
      .delete(projectSecrets)
      .where(
        and(
          eq(projectSecrets.id, id),
          eq(projectSecrets.project_id, projectId),
        ),
      );

    // Log deletion -- swallow logging errors instead of disrupting secret delete
    try {
      const logPromise = vault.logAccess({
        secretId: null, // Secret is deleted, so ID will be null
        secretName: existing.name,
        projectId: existing.project_id,
        accessedBy: (c.user?.id as string) || null,
        accessType: "delete",
      });

      // Use waitUntil if available for background logging
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(logPromise);
      } else {
        await logPromise;
      }
    } catch (err) {
      // Logging failure is non-fatal -- do not disrupt secret deletion
      console.error("[SECRETS_DELETE] Failed to log secret access:", err);
    }

    return { success: true };
  },
});

// SECRETS_PROMPT_USER
const promptUserForSecretSchema = z.object({
  name: z
    .string()
    .regex(
      /^[A-Z0-9_]+$/,
      "Secret name must be uppercase alphanumeric with underscores only",
    )
    .describe("The name of the secret to prompt for"),
  description: z
    .string()
    .optional()
    .describe("Optional description to show the user"),
});

export type PromptUserForSecretInput = z.infer<
  typeof promptUserForSecretSchema
>;

export const promptUserForSecret = createTool({
  name: "SECRETS_PROMPT_USER",
  description:
    "Prompt the user to input a secret value via UI. Use this when a tool needs a secret that doesn't exist yet.",
  inputSchema: z.lazy(() => promptUserForSecretSchema),
  outputSchema: z.lazy(() =>
    z.object({
      name: z.string(),
      description: z.string().optional(),
      action: z.literal("prompt_user_for_secret"),
    }),
  ),
  handler: async (props, c) => {
    c.resourceAccess.grant();

    const { name, description } = props;

    // Return a special response that the UI will detect and render as a prompt
    return {
      name,
      description,
      action: "prompt_user_for_secret" as const,
    };
  },
});
