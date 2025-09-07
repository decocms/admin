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
) =>
  MCPClient.forLocator(locator)
    .MODELS_LIST(options, init)
    .then((res) => res.items);

export const getModel = (
  locator: ProjectLocator,
  id: string,
  init?: RequestInit,
) => MCPClient.forLocator(locator).MODELS_GET({ id }, init);

export const createModel = (
  locator: ProjectLocator,
  input: CreateModelInput,
  init?: RequestInit,
) => MCPClient.forLocator(locator).MODELS_CREATE(input, init);

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
) => MCPClient.forLocator(locator).MODELS_UPDATE(input, init);

export const deleteModel = (
  locator: ProjectLocator,
  id: string,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.forLocator(locator).MODELS_DELETE({ id }, init) as Promise<{
    success: boolean;
  }>;
