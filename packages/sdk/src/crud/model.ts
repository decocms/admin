import type { Model } from "../constants.ts";
import { MCPClient } from "../fetcher.ts";
import type { CreateModelInput } from "../mcp/models/api.ts";
import { ProjectLocator } from "../locator.ts";

export interface ListModelsInput {
  excludeDisabled?: boolean;
  excludeAuto?: boolean;
}

export const listModels = (
  workspace: ProjectLocator,
  options: ListModelsInput = {},
  init?: RequestInit,
) =>
  MCPClient.forWorkspace(workspace)
    .MODELS_LIST(options, init)
    .then((res) => res.items);

export const getModel = (
  workspace: ProjectLocator,
  id: string,
  init?: RequestInit,
) => MCPClient.forWorkspace(workspace).MODELS_GET({ id }, init);

export const createModel = (
  workspace: ProjectLocator,
  input: CreateModelInput,
  init?: RequestInit,
) => MCPClient.forWorkspace(workspace).MODELS_CREATE(input, init);

export interface UpdateModelInput {
  id: string;
  data: Partial<
    Pick<Model, "name" | "model" | "description" | "isEnabled"> & {
      apiKey?: string | null;
    }
  >;
  [key: string]: unknown;
}

export const updateModel = (
  workspace: ProjectLocator,
  input: UpdateModelInput,
  init?: RequestInit,
) => MCPClient.forWorkspace(workspace).MODELS_UPDATE(input, init);

export const deleteModel = (
  workspace: ProjectLocator,
  id: string,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.forWorkspace(workspace).MODELS_DELETE({ id }, init) as Promise<{
    success: boolean;
  }>;
