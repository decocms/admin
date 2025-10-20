import {
  findConnectionView,
  useConnectionViews,
  useIntegrations,
} from "@deco/sdk";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router";
import Preview from "../agent/preview";
import { EmptyState } from "../common/empty-state.tsx";
import { useSetThreadContextEffect } from "../decopilot/thread-context-provider.tsx";
import { InternalResourceListWithIntegration } from "./internal-resource-list.tsx";

interface Props {
  integrationId?: string;
  integration?: {
    id: string;
    name: string;
    icon?: string;
    description?: string;
    connection?: { type?: string; url?: string };
  };
  resolvedUrl: string;
  embeddedName?: string;
  view?: {
    title?: string;
    icon?: string;
    url?: string;
    rules?: string[];
  };
}

function PreviewTab({
  embeddedName,
  integrationId,
  integration,
  resolvedUrl,
  view,
}: Props) {
  if (resolvedUrl.startsWith("internal://resource/list")) {
    if (!embeddedName || !integrationId) {
      return (
        <EmptyState
          icon="report"
          title="Missing embedded name or integration id"
          description="The embedded name or integration id is missing from the URL parameters. This is likely a bug in the system, please report it to the team."
        />
      );
    }

    return (
      <InternalResourceListWithIntegration
        name={embeddedName}
        integrationId={integrationId}
      />
    );
  }

  if (resolvedUrl.startsWith("internal://resource/detail")) {
    return (
      <EmptyState
        icon="report"
        title="Not implemented yet"
        description="This view is not implemented yet."
      />
    );
  }

  const relativeTo =
    integration?.connection?.type === "HTTP"
      ? (integration?.connection?.url ?? "")
      : "";
  const src = new URL(resolvedUrl, relativeTo).href;

  return <Preview src={src} title={view?.title || "Untitled view"} />;
}

export default function ViewDetail() {
  const { integrationId, viewName } = useParams();
  const [searchParams] = useSearchParams();
  const url = searchParams.get("viewUrl") || searchParams.get("url");
  const { data: integrations = [] } = useIntegrations();

  const integration = useMemo(
    () => integrations.find((i) => i.id === integrationId),
    [integrations, integrationId],
  );

  const { data: connectionViews } = useConnectionViews(integration ?? null);

  const connectionViewMatch = useMemo(
    () => findConnectionView(connectionViews?.views, { viewName, url }),
    [connectionViews, viewName, url],
  );

  const resolvedUrl = url || connectionViewMatch?.url || "";

  const embeddedName = useMemo(() => {
    if (!resolvedUrl) {
      return undefined;
    }
    try {
      const u = new URL(resolvedUrl);
      return u.searchParams.get("name") ?? undefined;
    } catch {
      return undefined;
    }
  }, [resolvedUrl]);

  // Prepare thread context for view
  const threadContextItems = useMemo(() => {
    if (!integrationId) return [];

    const contextItems = [];

    // Check if the view has specific tools defined
    const matched = (connectionViews?.views ?? []).find(
      (v) => v.name === viewName,
    );

    // Add rules if present
    if (matched?.rules) {
      contextItems.push(
        ...matched.rules.map((text) => ({
          id: crypto.randomUUID(),
          type: "rule" as const,
          text,
        })),
      );
    }

    // Add toolset
    let tools: string[] = [];
    if (matched && Array.isArray(matched.tools)) {
      tools = matched.tools;
    } else if (Array.isArray(integration?.tools)) {
      tools = integration.tools.map((t) => t.name);
    }

    if (tools.length > 0) {
      contextItems.push({
        id: crypto.randomUUID(),
        type: "toolset" as const,
        integrationId,
        enabledTools: tools,
      });
    }

    return contextItems;
  }, [integrationId, viewName, connectionViews, integration]);

  useSetThreadContextEffect(threadContextItems);

  return (
    <div className="h-[calc(100vh-48px)]">
      <PreviewTab
        integrationId={integrationId}
        integration={integration}
        resolvedUrl={resolvedUrl}
        embeddedName={embeddedName}
        view={connectionViewMatch}
      />
    </div>
  );
}
