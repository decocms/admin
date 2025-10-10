import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createPrompt,
  type CreatePromptInput,
  deletePrompt,
  getPrompt,
  getPromptVersions,
  listPrompts,
  updatePrompt,
  type UpdatePromptInput,
} from "../crud/prompts.ts";
import { InternalServerError } from "../errors.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export const usePrompts = (input?: {
  ids?: string[];
  resolveMentions?: boolean;
  excludeIds?: string[];
}) => {
  const { locator } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.PROMPTS(
      locator,
      input?.ids,
      input?.resolveMentions,
      input?.excludeIds,
    ),
    queryFn: ({ signal }) => listPrompts(locator, input, { signal }),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });
};

export const usePrompt = (id: string = "") => {
  const { locator } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.PROMPT(locator, id),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    queryFn: ({ signal }) => {
      if (!id.length) {
        return null;
      }
      return getPrompt(locator, id, { signal });
    },
  });
};

export function useCreatePrompt() {
  const { locator } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePromptInput) => createPrompt(locator, input),
    onSuccess: (result) => {
      client.invalidateQueries({
        queryKey: KEYS.PROMPTS(locator).slice(0, 2),
      });
      client.setQueryData(["prompt", result.id], result);
    },
  });
}

export function useUpdatePrompt() {
  const { locator } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePromptInput) => updatePrompt(locator, input),
    onSuccess: (result) => {
      client.invalidateQueries({
        queryKey: KEYS.PROMPTS(locator).slice(0, 2),
      });
      client.invalidateQueries({
        queryKey: KEYS.PROMPT_VERSIONS(locator, result.id),
      });
      client.setQueryData(["prompt", result.id], result);
    },
  });
}

export function useDeletePrompt() {
  const { locator } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePrompt(locator, id),
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: KEYS.PROMPTS(locator).slice(0, 2),
      });
    },
  });
}

export function usePromptVersions(
  id: string,
  limit: number = 10,
  offset: number = 0,
) {
  const { locator } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.PROMPT_VERSIONS(locator, id),
    queryFn: ({ signal }) =>
      getPromptVersions(locator, { id, limit, offset }, { signal }),
  });
}
