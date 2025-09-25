import {
  findConnectionView,
  useConnectionViews,
  useIntegrations,
} from "@deco/sdk";
import { createContext, useContext, useMemo } from "react";
import { useParams, useSearchParams } from "react-router";
import { dispatchRulesUpdated } from "../../utils/events.ts";
import Preview from "../agent/preview";
import { EmptyState } from "../common/empty-state.tsx";
import { InternalResourceListWithIntegration } from "./internal-resource-list.tsx";
import { ViewRouteProvider } from "./view-route-context.tsx";
import { WorkflowView } from "./workflow-view.tsx";

interface ViewDetailContextValue {
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

const ViewDetailContext = createContext<ViewDetailContextValue | undefined>(
  undefined,
);

function useViewDetail(): ViewDetailContextValue {
  const ctx = useContext(ViewDetailContext);
  if (!ctx) {
    return { resolvedUrl: "" };
  }
  return ctx;
}

function PreviewTab() {
  const { embeddedName, integrationId, integration, resolvedUrl, view } =
    useViewDetail();

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
    if (embeddedName === "workflow") {
      return <WorkflowView />;
    }

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

  const connectionViewMatch = useMemo(() => {
    return findConnectionView(connectionViews?.views, { viewName, url });
  }, [connectionViews, viewName, url]);

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

  // Seed rules for this view when present (no effect outside view routes)
  const rules = (connectionViewMatch?.rules ?? []) as string[];
  if (rules.length) {
    // Single dispatch based on current render; upstream keeps last update
    dispatchRulesUpdated({ rules });
  }

  return (
    <ViewRouteProvider
      integrationId={integrationId}
      viewName={viewName}
      view={connectionViewMatch}
    >
      <ViewDetailContext.Provider
        value={{
          integrationId,
          integration,
          resolvedUrl,
          embeddedName,
          view: connectionViewMatch,
        }}
      >
        <PreviewTab />
      </ViewDetailContext.Provider>
    </ViewRouteProvider>
  );
}
