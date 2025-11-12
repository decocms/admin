import {
  findConnectionView,
  useConnectionViews,
  useIntegrations,
} from "@deco/sdk";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router";
import Preview from "../agent/preview";
import { EmptyState } from "../common/empty-state.tsx";
import { InternalResourceListWithIntegration } from "./internal-resource-list.tsx";
import { useRouteParams } from "../canvas/route-params-provider.tsx";

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
  // Check for params from RouteParamsProvider (for tab rendering)
  // Fall back to URL params (for direct navigation)
  const routeParams = useRouteParams();
  const urlParams = useParams();
  const integrationId = routeParams.integrationId || urlParams.integrationId;
  const viewName = routeParams.viewName || urlParams.viewName;

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
