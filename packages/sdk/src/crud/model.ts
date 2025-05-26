import { Model } from "../constants.ts";
import { MCPClient } from "../fetcher.ts";

export const listModels = (
  workspace: string,
  options: { excludeDisabled?: boolean; excludeAuto?: boolean },
  init?: RequestInit,
) => MCPClient.forWorkspace(workspace).MODELS_LIST(options, init);

export const getModel = (
  workspace: string,
  id: string,
  init?: RequestInit,
) => MCPClient.forWorkspace(workspace).MODELS_GET({ id }, init);

export interface CreateModelInput {
  name: string;
  model: string;
  apiKey?: string;
  description?: string;
  isEnabled: boolean;
  byDeco: boolean;
  workspace: string;
}

export const createModel = (
  workspace: string,
  input: CreateModelInput,
  init?: RequestInit,
) => MCPClient.forWorkspace(workspace).MODELS_CREATE(input, init);

export interface UpdateModelInput {
  id: string;
  data: Partial<
    Pick<Model, "name" | "model" | "description" | "isEnabled"> & {
      apiKey?: string;
    }
  >;
  [key: string]: unknown;
}

export const updateModel = (
  workspace: string,
  input: UpdateModelInput,
  init?: RequestInit,
) => MCPClient.forWorkspace(workspace).MODELS_UPDATE(input, init);

export const deleteModel = (
  workspace: string,
  id: string,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.forWorkspace(workspace).MODELS_DELETE({ id }, init) as Promise<
    { success: boolean }
  >;
