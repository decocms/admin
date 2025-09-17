import { useSuspenseQuery } from "@tanstack/react-query";
import { getRegistryApp } from "../crud/registry.ts";

export class RegistryAppNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryAppNotFoundError";
  }
}

export type RegistryApp = Awaited<ReturnType<typeof getRegistryApp>>;

/**
 * Hook to get a registry app by client ID in the format @scope/app-name
 * @param params - Object containing clientId in format @scope/app-name
 */
export const useRegistryApp = (params: { clientId: string }) => {
  return useSuspenseQuery({
    queryKey: ["registry-app", params.clientId],
    queryFn: async () => {
      if (!params.clientId) {
        return null;
      }
      try {
        return await getRegistryApp({ name: params.clientId });
      } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message.includes("not found")) {
          throw new RegistryAppNotFoundError("App not found");
        }

        throw error;
      }
    },
  });
};
