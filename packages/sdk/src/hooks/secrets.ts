import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createSecret,
  deleteSecret,
  listSecrets,
  updateSecret,
} from "../crud/secret.ts";
import { InternalServerError } from "../errors.ts";
import type {
  CreateSecretInput,
  ListSecretsInput,
  UpdateSecretInput,
} from "../mcp/secrets/api.ts";
import { KEYS } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";

export type { CreateSecretInput, ListSecretsInput, UpdateSecretInput };

export const useSecrets = (options: ListSecretsInput = {}) => {
  const { locator } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.SECRETS(locator, options),
    queryFn: ({ signal }) => listSecrets(locator, options, { signal }),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });
};

export function useCreateSecret() {
  const { locator } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSecretInput) => createSecret(locator, input),
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: KEYS.SECRETS(locator).slice(0, 2),
      });
    },
  });
}

export function useUpdateSecret() {
  const { locator } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSecretInput) => updateSecret(locator, input),
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: KEYS.SECRETS(locator).slice(0, 2),
      });
    },
  });
}

export function useDeleteSecret() {
  const { locator } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSecret(locator, id),
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: KEYS.SECRETS(locator).slice(0, 2),
      });
    },
  });
}
