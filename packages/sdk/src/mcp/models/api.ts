import { z } from "zod";
import { assertHasWorkspace, bypass } from "../assertions.ts";
import { createTool } from "../context.ts";
import { DEFAULT_MODEL, Model, MODELS } from "../../constants.ts";

interface ModelTable {
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

/**
 * Hashes a token using SHA-256 and returns the base64 encoded string
 */
export async function hashToken(token: string): Promise<string> {
  // TODO: hash method
  return token;
}

export const createModel = createTool({
  name: "MODELS_CREATE",
  description: "Create a new model",
  inputSchema: z.object({
    name: z.string(),
    model: z.string(),
    apiKey: z.string().optional(),
    byDeco: z.boolean().optional(),
    description: z.string().optional(),
  }),
  canAccess: bypass,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const { name, model, apiKey, byDeco, description } = props;
    const hash = apiKey ? await hashToken(apiKey) : null;

    const { data, error } = await c
      .db
      .from("models")
      .insert({
        workspace,
        name,
        model,
        api_key_hash: hash,
        is_enabled: true,
        by_deco: byDeco,
        description,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  },
});

export const updateModel = createTool({
  name: "MODELS_UPDATE",
  description: "Update an existing model",
  inputSchema: z.object({
    id: z.string().describe("The id of the model to update"),
    data: z.object({
      label: z.string().optional(),
      model: z.string().optional(),
      api_key: z.string().optional(),
      is_enabled: z.boolean().optional(),
      by_deco: z.boolean().optional(),
    }),
  }),
  canAccess: bypass,
  handler: async (props, c) => {
    const { id, data: { api_key, ...modelData } } = props;
    const updateData = { ...modelData };

    if (api_key) {
      // @ts-expect-error ignore for now
      updateData.api_key_hash = await hashToken(api_key);
    }

    const { data, error } = await c
      .db
      .from("models")
      .update(updateData)
      .eq("id", id)
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

    return data;
  },
});

export const deleteModel = createTool({
  name: "MODELS_DELETE",
  description: "Delete a model by id",
  inputSchema: z.object({
    id: z.string(),
  }),
  canAccess: bypass,
  handler: async (props, c) => {
    const { id } = props;

    const { error } = await c.db
      .from("models")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return { success: true };
  },
});

export const listModels = createTool({
  name: "MODELS_LIST",
  description: "List models for the current user",
  inputSchema: z.object({
    excludeDisabled: z.boolean().optional(),
    excludeAuto: z.boolean().optional(),
  }),
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

    const allModels = [...models, ...dbModels].map((m) => parseModel(m)).filter(
      (m) => !excludeDisabled || m.isEnabled,
    );

    return allModels;
  },
});

const parseModel = (model: ModelTable): Model => {
  const defaultModel = MODELS.find((m) => m.model === model.model);

  return {
    id: model.id,
    name: model.name,
    model: model.model,
    logo: defaultModel?.logo ?? "",
    capabilities: defaultModel?.capabilities ?? [],
    legacyId: defaultModel?.legacyId,
    description: model.description,
    byDeco: model.by_deco,
    isEnabled: model.is_enabled,
    hasCustomKey: !!model.api_key_hash,
  };
};

export const getModel = createTool({
  name: "MODELS_GET",
  description: "Get a model by id",
  inputSchema: z.object({
    id: z.string(),
  }),
  canAccess: bypass,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const { id } = props;

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

    return parseModel(data);
  },
});
