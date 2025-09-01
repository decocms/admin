import { useMemo } from "react";
import { useParams } from "react-router";
import { useIntegrations } from "@deco/sdk";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";

/**
 * Returns additionalTools mapping for useChat: { [integrationId]: [] }
 * when on /views/:id and the view has an associated integration; otherwise undefined.
 * Empty array means expose all tools from that integration.
 */
export function useViewAdditionalTools(): Record<string, string[]> | undefined {
  const { id: viewId } = useParams();
  const { data: integrations = [] } = useIntegrations();
  const team = useCurrentTeam();

  return useMemo(() => {
    if (!viewId) return undefined;
    const view = team.views.find((v) => v.id === viewId);
    const integrationId = (view?.metadata as any)?.integration?.id as
      | string
      | undefined;
    if (!integrationId) return undefined;
    const integration = integrations.find((i) => i.id === integrationId);
    const toolNames = Array.isArray((integration as any)?.tools)
      ? ((integration as any).tools as Array<{ name: string }>).map((t) => t.name)
      : [];
    // If no tools metadata available, default to empty array (server: expose all)
    return { [integrationId]: toolNames } as Record<string, string[]>;
  }, [viewId, team.views, integrations]);
}
