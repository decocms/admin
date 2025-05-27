import { z } from "zod";
import { DEFAULT_MODEL, Model, MODELS } from "../../constants.ts";
import { assertHasWorkspace, bypass } from "../assertions.ts";
import { createTool } from "../context.ts";
import { SupabaseLLMVault } from "./llmVault.ts";

interface ModelRow {
  id: string;
  name: string;
  model: string;
  is_enabled: boolean;
  api_key_hash: string | null;
  by_deco: boolean;
  created_at: string;
  updated_at: string;
  description: string;
}

const formatModelRow = (model: ModelRow): Model => {
  const defaultModel = MODELS.find((m) => m.model === model.model);

  return {
    id: model.id,
    name: model.name,
    model: model.model,
    logo: defaultModel?.logo ?? "",
    capabilities: defaultModel?.capabilities ?? [],
    legacyId: defaultModel?.legacyId,
    description: model.description || undefined,
    byDeco: model.by_deco,
    isEnabled: model.is_enabled,
    hasCustomKey: !!model.api_key_hash,
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

export const createModel = createTool({
  name: "MODELS_CREATE",
  description: "Create a new model",
  inputSchema: createModelSchema,
  canAccess: bypass,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const { name, model, apiKey, byDeco, description, isEnabled } = props;

    const { data, error } = await c
      .db
      .from("models")
      .insert({
        workspace,
        name,
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
        c.envVars.API_KEY_ENCRYPTION_KEY,
      );
      await llmVault.storeApiKey(data.id, workspace, apiKey);
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
  canAccess: bypass,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const { id, data: modelData } = props;
    const updateData: Partial<ModelRow> = {};

    for (const [key, value] of Object.entries(modelData)) {
      if (key === "apiKey") {
        if (typeof value === "string" || value === null) {
          const llmVault = new SupabaseLLMVault(
            c.db,
            c.envVars.API_KEY_ENCRYPTION_KEY,
          );

          await llmVault.updateApiKey(id, workspace, value);
        }

        continue;
      }

      if (typeof value === "string") {
        // @ts-expect-error - we know that the key is a valid property
        updateData[keyMap[key]] = value;
      }
    }

    const { data, error } = await c
      .db
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
  canAccess: bypass,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const { id } = props;

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

export const listModels = createTool({
  name: "MODELS_LIST",
  description: "List models for the current user",
  inputSchema: listModelsSchema,
  canAccess: bypass,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const { excludeDisabled, excludeAuto } = props;

    const { data, error } = await c
      .db
      .from("models")
      .select(`
        id,
        model,
        is_enabled,
        api_key_hash,
        created_at,
        updated_at,
        by_deco,
        name,
        description
      `)
      .eq("workspace", workspace);

    if (error) throw error;

    const models = MODELS.filter((m) =>
      !excludeAuto || m.model !== DEFAULT_MODEL
    ).map((model) => {
      const override = data.find((m) => m.model === model.model && m.by_deco);

      return {
        id: override?.id ?? model.id,
        name: override?.name ?? model.name,
        model: override?.model ?? model.model,
        api_key_hash: override?.api_key_hash,
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
      .filter((m) => !excludeDisabled || m.isEnabled);

    return allModels;
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
  canAccess: bypass,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const { id } = props;

    const defaultModel = MODELS.find((m) => m.id === id);

    if (defaultModel) {
      return defaultModel;
    }

    const { data, error } = await c
      .db
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
