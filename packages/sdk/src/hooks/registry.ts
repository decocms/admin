import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { getRegistryApp } from "../crud/registry.ts";
import { KEYS } from "./react-query-keys.ts";

export class RegistryAppNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryAppNotFoundError";
  }
}

export type RegistryApp = Awaited<ReturnType<typeof getRegistryApp>>;

/**
 * Hook to get a registry app by name in the format @scope/app-name
 */
export const useRegistryApp = (params: {
  app: string;
  mode?: "suspense" | "sync";
}) => {
  const mode = useRef(params.mode ?? "suspense");
  const useQueryMode =
    mode.current === "suspense" ? useSuspenseQuery : useQuery;
  return useQueryMode({
    queryKey: KEYS.REGISTRY_APP(params.app),
    queryFn: async () => {
      if (!params.app) {
        return null;
      }
      try {
        return await getRegistryApp({ name: params.app });
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

/**
 * Hook to safely get a registry app by name without throwing errors.
 * Returns null if the app is not found or if there's an error.
 * Useful when you want to check if an app exists with fallback logic.
 */
export const maybeRegistryApp = (params: { app: string }) => {
  const { data, error } = useSuspenseQuery({
    queryKey: KEYS.REGISTRY_APP(params.app),
    queryFn: async () => {
      if (!params.app) {
        return null;
      }
      try {
        return await getRegistryApp({ name: params.app });
      } catch (error) {
        console.debug(`Registry app not found: ${params.app}`, error);
        return null;
      }
    },
  });

  return error ? null : data;
};
