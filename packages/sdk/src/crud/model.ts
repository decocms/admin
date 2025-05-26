import { MCPClient } from "../fetcher.ts";

export interface Model {
  id: string;
  label: string;
  model: string;
  api_key_hash: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  is_enabled: boolean;
  endpoint: string;
}

export const listModels = (
  workspace: string,
  init?: RequestInit,
): Promise<Model[]> => MCPClient.forWorkspace(workspace).MODELS_LIST({}, init);

export const getModel = (
  workspace: string,
  id: string,
  init?: RequestInit,
): Promise<Model> => MCPClient.forWorkspace(workspace).MODELS_GET({ id }, init);

export interface CreateModelInput {
  label: string;
  model: string;
  api_key: string;
  endpoint: string;
}

export const createModel = (
  workspace: string,
  input: CreateModelInput,
  init?: RequestInit,
): Promise<Model> =>
  MCPClient.forWorkspace(workspace).MODELS_CREATE(input, init) as Promise<
    Model
  >;

export interface UpdateModelInput {
  id: string;
  data: Partial<
    Pick<Model, "label" | "model" | "endpoint" | "is_enabled"> & {
      api_key?: string;
    }
  >;
  [key: string]: unknown;
}

export const updateModel = (
  workspace: string,
  input: UpdateModelInput,
  init?: RequestInit,
): Promise<Model> =>
  MCPClient.forWorkspace(workspace).MODELS_UPDATE(input, init) as Promise<
    Model
  >;

export const deleteModel = (
  workspace: string,
  id: string,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.forWorkspace(workspace).MODELS_DELETE({ id }, init) as Promise<
    { success: boolean }
  >;
