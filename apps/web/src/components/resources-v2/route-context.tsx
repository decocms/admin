import { createContext, useContext } from "react";
import type { MCPConnection } from "@deco/sdk";

interface ResourceRouteContextValue {
  integrationId?: string;
  resourceName?: string;
  resourceUri?: string;
  connection?: MCPConnection;
}

const ResourceRouteContext = createContext<
  ResourceRouteContextValue | undefined
>(undefined);

export function ResourceRouteProvider(
  props: ResourceRouteContextValue & { children: React.ReactNode },
) {
  const { children, ...value } = props;
  return (
    <ResourceRouteContext.Provider value={value}>
      {children}
    </ResourceRouteContext.Provider>
  );
}

export function useResourceRoute(): ResourceRouteContextValue {
  const ctx = useContext(ResourceRouteContext);
  if (!ctx) return {};
  return ctx;
}
