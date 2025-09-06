import { useMemo } from "react";
import { useConnectionViews, useIntegration } from "@deco/sdk";

export interface IntegrationViewItem {
  name?: string;
  title: string;
  icon: string;
  url?: string;
  tools?: string[];
  rules?: string[];
}

export function useView(
  integrationId?: string,
  viewName?: string,
): IntegrationViewItem | undefined {
  const { data: integration } = useIntegration(integrationId || "");
  const { data: connectionViews } = useConnectionViews(
    integration ? { id: integration.id, connection: integration.connection } : null,
  );

  return useMemo(() => {
    if (!viewName) return undefined;
    const views = connectionViews?.views ?? [];
    return views.find((v: any) => v.name === viewName) as IntegrationViewItem | undefined;
  }, [connectionViews, viewName]);
}


