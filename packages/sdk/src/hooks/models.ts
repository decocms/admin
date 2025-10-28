import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createModel,
  deleteModel,
  getModel,
  listModels,
  updateModel,
} from "../crud/model.ts";
import { InternalServerError } from "../errors.ts";
import type {
  CreateModelInput,
  DeleteModelInput,
  GetModelInput,
  ListModelsInput,
  UpdateModelInput,
} from "../mcp/models/api.ts";
import { KEYS } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";

export type {
  CreateModelInput,
  DeleteModelInput,
  GetModelInput,
  ListModelsInput,
  UpdateModelInput,
};

export const useModels = (options: ListModelsInput = {}) => {
  const { locator } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.MODELS(locator, options),
    queryFn: ({ signal }) => listModels(locator, options, { signal }),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });
};

export const useModel = (id: string) => {
  const { locator } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.MODEL(locator, id),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    queryFn: ({ signal }) => getModel(locator, id, { signal }),
  });
};

export function useCreateModel() {
  const { locator } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateModelInput) => createModel(locator, input),
    onSuccess: (result) => {
      client.invalidateQueries({
        queryKey: KEYS.MODELS(locator).slice(0, 2),
      });
      client.setQueryData(KEYS.MODELS(locator), result);
      client.setQueryData(KEYS.MODEL(locator, result.id), result);
    },
  });
}

export function useUpdateModel() {
  const { locator } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateModelInput) => updateModel(locator, input),
    onSuccess: (result) => {
      client.invalidateQueries({
        queryKey: KEYS.MODELS(locator).slice(0, 2),
      });
      client.setQueryData(KEYS.MODEL(locator, result.id), result);
    },
  });
}

export function useDeleteModel() {
  const { locator } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteModel(locator, id),
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: KEYS.MODELS(locator).slice(0, 2),
      });
    },
  });
}
