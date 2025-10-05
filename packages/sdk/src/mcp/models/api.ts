import { z } from "zod";
import {
  type Model,
  type ModelRuntimeStatus,
  WELL_KNOWN_MODELS,
} from "../../constants.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createToolGroup } from "../context.ts";
import type { AppContext } from "../index.ts";
import { SupabaseLLMVault } from "./llm-vault.ts";

interface ModelRow {
  id: string;
  name: string;
  model: string;
  is_enabled: boolean;
  api_key_hash?: string | null;
  by_deco: boolean;
  created_at: string;
  updated_at: string;
  description?: string | null;
}

const OLLAMA_PROVIDER_PREFIX = "ollama:";
const OLLAMA_DEFAULT_MODEL_NAME = "qwen3:4b-instruct";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

const stripTrailingSlash = (value: string): string =>
  value.endsWith("/") ? value.slice(0, -1) : value;

const createTimeoutSignal = (timeoutMs: number): AbortSignal | undefined => {
  const Abort = AbortSignal as typeof AbortSignal & {
    timeout?: (delay: number) => AbortSignal;
  };
  return typeof Abort.timeout === "function"
    ? Abort.timeout(timeoutMs)
    : undefined;
};

const detectOllamaRuntimeStatus = async ({
  baseUrl,
  modelName,
  timeoutMs = 1_500,
}: {
  baseUrl: string;
  modelName: string;
  timeoutMs?: number;
}): Promise<ModelRuntimeStatus> => {
  const checkedAt = new Date().toISOString();
  const signal = createTimeoutSignal(timeoutMs);

  const versionUrl = `${stripTrailingSlash(baseUrl)}/api/version`;

  try {
    const response = await fetch(versionUrl, { signal });
    if (!response.ok) {
      return {
        state: "unavailable",
        reason: `Ollama responded with status ${response.status}`,
        checkedAt,
      };
    }
  } catch (error) {
    return {
      state: "unavailable",
      reason:
        error instanceof Error
          ? error.message
          : "Failed to reach Ollama instance",
      checkedAt,
    };
  }

  const tagsUrl = `${stripTrailingSlash(baseUrl)}/api/tags`;

  try {
    const response = await fetch(tagsUrl, { signal });
    if (!response.ok) {
      return {
        state: "model-missing",
        reason: `Could not list models (status ${response.status})`,
        checkedAt,
      };
    }

    const payload = (await response.json()) as {
      models?: Array<{ name?: string | null } | Record<string, unknown>>;
    };
    const models = Array.isArray(payload.models) ? payload.models : [];
    const hasModel = models.some((entry) => {
      const candidate = (entry as { name?: unknown }).name;
      return typeof candidate === "string" && candidate === modelName;
    });

    if (!hasModel) {
      return {
        state: "model-missing",
        reason: `Model '${modelName}' is not available in Ollama`,
        checkedAt,
      };
    }

    return {
      state: "available",
      checkedAt,
    };
  } catch (error) {
    return {
      state: "model-missing",
      reason:
        error instanceof Error
          ? error.message
          : "Failed to inspect Ollama models",
      checkedAt,
    };
  }
};

const annotateOllamaRuntimeStatus = async (
  models: Model[],
  {
    envVars,
    db,
    workspace,
  }: {
    envVars: AppContext["envVars"];
    db: AppContext["db"];
    workspace: string;
  },
): Promise<Model[]> => {
  const hasOllamaModel = models.some((model) =>
    model.model.startsWith(OLLAMA_PROVIDER_PREFIX),
  );

  if (!hasOllamaModel) {
    return models;
  }

  const llmVault =
    envVars.LLMS_ENCRYPTION_KEY && envVars.LLMS_ENCRYPTION_KEY.length === 32
      ? new SupabaseLLMVault(db, envVars.LLMS_ENCRYPTION_KEY, workspace)
      : undefined;

  const annotateModel = async (model: Model): Promise<Model> => {
    if (!model.model.startsWith(OLLAMA_PROVIDER_PREFIX)) {
      return model;
    }

    let baseUrl = envVars.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL;

    if (model.hasCustomKey && llmVault) {
      try {
        const { apiKey } = await llmVault.readApiKey(model.id);
        if (apiKey?.trim()) {
          baseUrl = apiKey.trim();
        }
      } catch (error) {
        return {
          ...model,
          runtimeStatus: {
            state: "unavailable",
            reason:
              error instanceof Error
                ? error.message
                : "Failed to read Ollama connection settings",
            checkedAt: new Date().toISOString(),
          },
        };
      }
    }

    const runtimeStatus = await detectOllamaRuntimeStatus({
      baseUrl,
      modelName: model.model.replace(OLLAMA_PROVIDER_PREFIX, ""),
    });

    return { ...model, runtimeStatus };
  };

  return await Promise.all(models.map(annotateModel));
};

const formatModelRow = (model: ModelRow, showApiKey = false): Model => {
  const defaultModel = WELL_KNOWN_MODELS.find((m) => m.model === model.model);

  return {
    id: model.id,
    name: model.name,
    model: model.model,
    logo: defaultModel?.logo ?? "",
    capabilities: defaultModel?.capabilities ?? [],
    legacyId: defaultModel?.legacyId,
    description: model.description ?? undefined,
    byDeco: model.by_deco,
    isEnabled: model.is_enabled,
    hasCustomKey: !!model.api_key_hash,
    apiKeyEncrypted: showApiKey ? (model.api_key_hash ?? undefined) : undefined,
  };
};

export const createModelSchema = z.object({
  name: z.string(),
  model: z.string(),
  apiKey: z.string().optional(),
  description: z.string().optional(),
  byDeco: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});

export type CreateModelInput = z.infer<typeof createModelSchema>;

const createTool = createToolGroup("Model", {
  name: "Model Management",
  description: "Configure custom language models.",
  icon: "https://assets.decocache.com/mcp/8d655881-941f-4b5b-8c30-5cf80bd00c9e/Model-Management.png",
});

export const createModel = createTool({
  name: "MODELS_CREATE",
  description: "Create a new model",
  inputSchema: createModelSchema,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    await assertWorkspaceResourceAccess(c);

    const {
      name: modelName,
      model,
      apiKey,
      byDeco,
      description,
      isEnabled,
    } = props;

    const { data, error } = await c.db
      .from("models")
      .insert({
        workspace,
        name: modelName,
        model,
        api_key_hash: null,
        is_enabled: isEnabled ?? true,
        by_deco: byDeco,
        description,
      })
      .select()
      .single();

    if (error) throw error;

    if (apiKey) {
      const llmVault = new SupabaseLLMVault(
        c.db,
        c.envVars.LLMS_ENCRYPTION_KEY,
        workspace,
      );
      await llmVault.storeApiKey(data.id, apiKey);
    }

    return formatModelRow(data);
  },
});

export const updateModelSchema = z.object({
  id: z.string(),
  data: z.object({
    name: z.string().optional(),
    model: z.string().optional(),
    apiKey: z.string().nullable().optional(),
    isEnabled: z.boolean().optional(),
    byDeco: z.boolean().optional(),
    description: z.string().optional(),
  }),
});

export type UpdateModelInput = z.infer<typeof updateModelSchema>;

const keyMap: Record<string, keyof ModelRow> = {
  name: "name",
  model: "model",
  apiKey: "api_key_hash",
  isEnabled: "is_enabled",
  byDeco: "by_deco",
  description: "description",
};

export const updateModel = createTool({
  name: "MODELS_UPDATE",
  description: "Update an existing model",
  inputSchema: updateModelSchema,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    await assertWorkspaceResourceAccess(c);

    const { id, data: modelData } = props;
    const updateData: Partial<ModelRow> = {};

    for await (const [key, value] of Object.entries(modelData)) {
      if (key === "apiKey") {
        if (typeof value === "string" || value === null) {
          const llmVault = new SupabaseLLMVault(
            c.db,
            c.envVars.LLMS_ENCRYPTION_KEY,
            workspace,
          );

          await llmVault.updateApiKey(id, value);
        }

        continue;
      }

      if (typeof value === "string" || typeof value === "boolean") {
        // @ts-expect-error - we know that the key is a valid property
        updateData[keyMap[key]] = value;
      }
    }

    // User is re-enabling a managed model, so we can just remove the db entry
    if (updateData.by_deco && updateData.is_enabled) {
      const wellKnownModel = WELL_KNOWN_MODELS.find(
        (knownModel) => knownModel.model === updateData.model,
      );

      if (!wellKnownModel) {
        throw new Error(`Model ${updateData.model} not found`);
      }

      await c.db
        .from("models")
        .delete()
        .eq("id", id)
        .eq("workspace", workspace);

      return wellKnownModel;
    }

    const { data, error } = await c.db
      .from("models")
      .update(updateData)
      .eq("id", id)
      .eq("workspace", workspace)
      .select(`
        id,
        name,
        model,
        is_enabled,
        api_key_hash,
        created_at,
        updated_at,
        by_deco,
        description
      `)
      .single();

    if (error) throw error;

    return formatModelRow(data);
  },
});

export const deleteModelSchema = z.object({
  id: z.string(),
});

export type DeleteModelInput = z.infer<typeof deleteModelSchema>;

export const deleteModel = createTool({
  name: "MODELS_DELETE",
  description: "Delete a model by id",
  inputSchema: deleteModelSchema,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const { id } = props;

    await assertWorkspaceResourceAccess(c);

    const { error } = await c.db
      .from("models")
      .delete()
      .eq("id", id)
      .eq("workspace", workspace);

    if (error) throw error;

    return { success: true };
  },
});

export const listModelsSchema = z.object({
  excludeDisabled: z.boolean().optional(),
  excludeAuto: z.boolean().optional(),
});

export type ListModelsInput = z.infer<typeof listModelsSchema>;

export const listModelsForWorkspace = async ({
  workspace,
  db,
  envVars,
  options,
}: {
  workspace: string;
  db: AppContext["db"];
  envVars: AppContext["envVars"];
  options?: {
    excludeDisabled?: boolean;
  };
}) => {
  const { data, error } = await db
    .from("models")
    .select(`
        id,
        model,
        is_enabled,
        created_at,
        updated_at,
        by_deco,
        name,
        description
      `)
    .eq("workspace", workspace);

  if (error) throw error;

  const models = WELL_KNOWN_MODELS.map((model) => {
    const override = data.find((m) => m.model === model.model && m.by_deco);

    return {
      id: override?.id ?? model.id,
      name: override?.name ?? model.name,
      model: override?.model ?? model.model,
      description: override?.description,
      by_deco: override?.by_deco ?? true,
      is_enabled: override?.is_enabled ?? true,
      created_at: override?.created_at ?? new Date().toISOString(),
      updated_at: override?.updated_at ?? new Date().toISOString(),
    };
  });

  const dbModels = data.filter((m) => !m.by_deco);

  const allModels = [...models, ...dbModels]
    .map((m) => formatModelRow(m))
    .filter((m) => !options?.excludeDisabled || m.isEnabled);

  const annotatedModels = await annotateOllamaRuntimeStatus(allModels, {
    envVars,
    db,
    workspace,
  });

  return annotatedModels;
};

export const listModels = createTool({
  name: "MODELS_LIST",
  description: "List models for the current user",
  inputSchema: listModelsSchema,
  outputSchema: z.object({
    items: z.array(z.any()),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const { excludeDisabled = false } = props;

    c.resourceAccess.grant();

    // This is a workaround to enable public agents
    const canAccess = await assertWorkspaceResourceAccess(c)
      .then(() => true)
      .catch(() => false);

    if (!canAccess) {
      return { items: [] };
    }

    const models = await listModelsForWorkspace({
      workspace,
      db: c.db,
      envVars: c.envVars,
      options: { excludeDisabled },
    });

    return { items: models };
  },
});

export const getModelSchema = z.object({
  id: z.string(),
});

export type GetModelInput = z.infer<typeof getModelSchema>;

export const getModel = createTool({
  name: "MODELS_GET",
  description: "Get a model by id",
  inputSchema: getModelSchema,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const { id } = props;

    await assertWorkspaceResourceAccess(c);

    const defaultModel = WELL_KNOWN_MODELS.find((m) => m.id === id);

    if (defaultModel) {
      return defaultModel;
    }

    const { data, error } = await c.db
      .from("models")
      .select(`
        id,
        name,
        model,
        is_enabled,
        api_key_hash,
        created_at,
        updated_at,
        by_deco,
        description
      `)
      .eq("id", id)
      .eq("workspace", workspace)
      .single();

    if (error) throw error;

    return formatModelRow(data);
  },
});
