import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAPIKey,
  getAPIKeyForIntegration,
  reissueAPIKey,
  type ApiKeyClaims,
} from "../crud/keys.ts";
import { useSDK } from "./store.tsx";
import { KEYS } from "./react-query-keys.ts";
import { Statement } from "../models/index.ts";

export const useCreateAPIKey = () => {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (params: {
      claims?: ApiKeyClaims;
      name: string;
      policies: Statement[];
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
      policies?: Statement[];
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
