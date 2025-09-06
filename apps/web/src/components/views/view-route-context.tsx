import { createContext, useContext } from "react";
import type { IntegrationViewItem } from "../decopilot/use-view.ts";

interface ViewRouteContextValue {
  integrationId?: string;
  viewName?: string;
  view?: IntegrationViewItem;
}

const ViewRouteContext = createContext<ViewRouteContextValue | undefined>(
  undefined,
);

export function ViewRouteProvider(
  props: ViewRouteContextValue & { children: React.ReactNode },
) {
  const { children, ...value } = props;
  return (
    <ViewRouteContext.Provider value={value}>
      {children}
    </ViewRouteContext.Provider>
  );
}

export function useViewRoute(): ViewRouteContextValue {
  const ctx = useContext(ViewRouteContext);
  if (!ctx) return {};
  return ctx;
}


