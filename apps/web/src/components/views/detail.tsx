import {
  findConnectionView,
  useConnectionViews,
  useIntegrations,
} from "@deco/sdk";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router";
import Preview from "../agent/preview";
import { EmptyState } from "../common/empty-state.tsx";
import { type DecopilotContextValue } from "../decopilot/context.tsx";
import { DecopilotLayout } from "../layout/decopilot-layout.tsx";
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

  // Prepare decopilot context value for view
  const decopilotContextValue = useMemo((): DecopilotContextValue => {
    if (!integrationId) return {};

    // Check if the view has specific tools defined
    const matched = (connectionViews?.views ?? []).find(
      (v) => v.name === viewName,
    );

    if (matched && Array.isArray(matched.tools)) {
      return {
        rules: matched.rules,
        additionalTools: { [integrationId]: matched.tools },
      };
    }

    // Fallback to all integration tools if no specific tools are defined
    const toolNames = Array.isArray(integration?.tools)
      ? integration.tools.map((t) => t.name)
      : [];

    return {
      rules: matched?.rules,
      additionalTools: { [integrationId]: toolNames },
    };
  }, [integrationId, viewName, connectionViews, integration]);

  return (
    <DecopilotLayout value={decopilotContextValue}>
      <div className="h-[calc(100vh-48px)]">
        <PreviewTab
          integrationId={integrationId}
          integration={integration}
          resolvedUrl={resolvedUrl}
          embeddedName={embeddedName}
          view={connectionViewMatch}
        />
      </div>
    </DecopilotLayout>
  );
}
