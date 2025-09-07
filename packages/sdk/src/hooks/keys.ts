import { useMutation } from "@tanstack/react-query";
import { createAPIKey } from "../crud/keys.ts";
import { useSDK } from "./store.tsx";

export const useCreateAPIKey = () => {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (params: {
      claims?: {
        appName: string;
        integrationId: string;
        state: unknown;
      };
      name: string;
      policies: Array<{ effect: "allow" | "deny"; resource: string }>;
    }) => createAPIKey(locator, params),
  });
};
