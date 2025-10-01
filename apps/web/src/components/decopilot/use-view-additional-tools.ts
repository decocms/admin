// deno-lint-ignore-file no-explicit-any
import { useMemo } from "react";
import { useConnectionViews, useIntegrations } from "@deco/sdk";
import { useParams } from "react-router";

/**
 * Returns additionalTools mapping for useChat: { [integrationId]: [] }
 * when on /views/:id and the view has an associated integration; otherwise undefined.
 * Empty array means expose all tools from that integration.
 */
export function useViewAdditionalTools(): Record<string, string[]> | undefined {
  const { integrationId, viewName } = useParams();
  const { data: integrations = [] } = useIntegrations();
  const integration = useMemo(
    () => integrations.find((i) => i.id === integrationId),
    [integrations, integrationId],
  );
  const { data: connectionViews } = useConnectionViews(integration ?? null);

  return useMemo(() => {
    if (!integrationId) return undefined;
    const matched = (connectionViews?.views ?? []).find(
      (v: any) => v.name === viewName,
    );
    if (matched && Array.isArray((matched as any).tools)) {
      return { [integrationId]: (matched as any).tools as string[] } as Record<
        string,
        string[]
      >;
    }
    const toolNames = Array.isArray((integration as any)?.tools)
      ? ((integration as any).tools as Array<{ name: string }>).map(
        (t) => t.name,
      )
      : [];
    return { [integrationId]: toolNames } as Record<string, string[]>;
  }, [integrationId, viewName, connectionViews, integration]);
}
