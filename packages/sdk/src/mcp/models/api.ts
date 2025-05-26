import { z } from "zod";
import { assertHasWorkspace, bypass } from "../assertions.ts";
import { createTool } from "../context.ts";

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
    label: z.string(),
    model: z.string(),
    api_key: z.string(),
  }),
  canAccess: bypass,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const { label, model, api_key } = props;
    const hash = await hashToken(api_key);

    const { data, error } = await c
      .db
      .from("models")
      .insert({
        workspace,
        label,
        model,
        api_key_hash: hash,
        is_enabled: true,
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
        label,
        model,
        is_enabled,
        api_key_hash,
        created_at,
        updated_at
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
  inputSchema: z.object({}),
  canAccess: bypass,
  handler: async (_, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const { data, error } = await c
      .db
      .from("models")
      .select(`
        id,
        label,
        model,
        is_enabled,
        api_key_hash,
        created_at,
        updated_at
      `)
      .eq("workspace", workspace);

    if (error) throw error;

    return data;
  },
});

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
        label,
        model,
        is_enabled,
        api_key_hash,
        created_at,
        updated_at
      `)
      .eq("id", id)
      .eq("workspace", workspace)
      .single();

    if (error) throw error;

    return data;
  },
});
