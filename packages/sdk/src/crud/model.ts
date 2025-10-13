import type { Model } from "../constants.ts";
import { MCPClient } from "../fetcher.ts";
import type { CreateModelInput } from "../mcp/models/api.ts";
import { ProjectLocator } from "../locator.ts";

export interface ListModelsInput {
  excludeDisabled?: boolean;
  excludeAuto?: boolean;
}

export const listModels = (
  locator: ProjectLocator,
  options: ListModelsInput = {},
  init?: RequestInit,
): Promise<Model[]> =>
  MCPClient.forLocator(locator)
    .MODELS_LIST(options, init)
    .then((res) => (res as { items: Model[] }).items);

export const getModel = (
  locator: ProjectLocator,
  id: string,
  init?: RequestInit,
): Promise<Model> =>
  MCPClient.forLocator(locator).MODELS_GET({ id }, init) as Promise<Model>;

export const createModel = (
  locator: ProjectLocator,
  input: CreateModelInput,
  init?: RequestInit,
): Promise<Model> =>
  MCPClient.forLocator(locator).MODELS_CREATE(input, init) as Promise<Model>;

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
  locator: ProjectLocator,
  input: UpdateModelInput,
  init?: RequestInit,
): Promise<{ id: string; [key: string]: unknown }> =>
  MCPClient.forLocator(locator).MODELS_UPDATE(input, init) as Promise<{
    id: string;
    [key: string]: unknown;
  }>;

export const deleteModel = (
  locator: ProjectLocator,
  id: string,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.forLocator(locator).MODELS_DELETE({ id }, init) as Promise<{
    success: boolean;
  }>;
