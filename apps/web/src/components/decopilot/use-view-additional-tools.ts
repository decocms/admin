// deno-lint-ignore-file no-explicit-any
import { useMemo } from "react";
import { useIntegrations } from "@deco/sdk";
import { useCurrentView } from "./use-current-view.ts";

/**
 * Returns additionalTools mapping for useChat: { [integrationId]: [] }
 * when on /views/:id and the view has an associated integration; otherwise undefined.
 * Empty array means expose all tools from that integration.
 */
export function useViewAdditionalTools(): Record<string, string[]> | undefined {
  const { data: integrations = [] } = useIntegrations();
  const { meta, integrationId } = useCurrentView();

  return useMemo(() => {
    if (!integrationId) return undefined;
    // Priority: view-defined tools (custom) -> integration tools -> expose all
    if (meta && meta.type === "custom" && Array.isArray((meta as any).tools)) {
      return { [integrationId]: (meta as any).tools as string[] } as Record<
        string,
        string[]
      >;
    }
    const integration = integrations.find((i) => i.id === integrationId);
    const toolNames = Array.isArray((integration as any)?.tools)
      ? ((integration as any).tools as Array<{ name: string }>).map(
          (t) => t.name,
        )
      : [];
    return { [integrationId]: toolNames } as Record<string, string[]>;
  }, [integrationId, meta, integrations]);
}
