import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAPIKey,
  getAPIKeyForIntegration,
  reissueAPIKey,
  type ApiKeyClaims,
  type ApiKeyPolicies,
} from "../crud/keys.ts";
import { useSDK } from "./store.tsx";
import { KEYS } from "./api.ts";

export const useCreateAPIKey = () => {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (params: {
      claims?: ApiKeyClaims;
      name: string;
      policies: ApiKeyPolicies;
    }) => createAPIKey(locator, params),
  });
};

export const useReissueAPIKey = () => {
  const client = useQueryClient();
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (params: {
      id: string;
      claims?: ApiKeyClaims;
      policies?: ApiKeyPolicies;
    }) => reissueAPIKey(locator, params),
    onSuccess: (result) => {
      client.invalidateQueries({
        queryKey: KEYS.INTEGRATION_API_KEY(locator, result.id),
      });
    },
  });
};

export const useIntegrationAPIKey = (integrationId: string) => {
  const { locator } = useSDK();

  return useQuery({
    queryKey: KEYS.INTEGRATION_API_KEY(locator, integrationId),
    queryFn: () => getAPIKeyForIntegration({ locator, integrationId }),
    enabled: !!integrationId,
  });
};
