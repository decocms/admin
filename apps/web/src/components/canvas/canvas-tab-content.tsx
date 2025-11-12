import { lazy, Suspense, useMemo } from "react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useThread, useIntegrations } from "@deco/sdk";
import { CanvasTab, parseResourceUri } from "../decopilot/thread-provider.tsx";
import { WELL_KNOWN_VIEWS } from "./well-known-views.tsx";
import { ResourcesV2List } from "../resources-v2/list.tsx";
import { DocumentsResourceList } from "../documents/documents-resource-list.tsx";
import { WorkflowsResourceList } from "../workflows/workflows-resource-list.tsx";
import { ToolsResourceList } from "../tools/tools-resource-list.tsx";
import { ViewsResourceList } from "../views/views-resource-list.tsx";
import { RouteParamsProvider } from "./route-params-provider.tsx";
import { ResourceRouteProvider } from "../resources-v2/route-context.tsx";

// Lazy load apps, agents, and database components for legacy compatibility
const InstalledAppsList = lazy(
  () => import("../integrations/installed-apps.tsx"),
);
const AppDetail = lazy(() => import("../integrations/app-detail.tsx"));
const AgentsResourceList = lazy(() =>
  import("../agents/agents-resource-list.tsx").then((m) => ({
    default: m.AgentsResourceList,
  })),
);
const AgentEdit = lazy(() => import("../agent/edit.tsx"));
const ViewDetail = lazy(() => import("../views/detail.tsx"));
const DatabaseStudio = lazy(() => import("../database/studio.tsx"));
const LegacyPromptDetail = lazy(() => import("../prompts/detail/detail.tsx"));
const WorkflowDetail = lazy(() => import("../workflows/detail.tsx"));
const TriggerDetails = lazy(() => import("../triggers/trigger-details.tsx"));
const ThreadConversation = lazy(() =>
  import("../audit/thread-conversation.tsx").then((m) => ({
    default: m.ThreadConversation,
  })),
);

interface CanvasTabContentProps {
  tab: CanvasTab;
}

function ResourceDetailView({
  integrationId,
  resourceName,
  resourceUri,
}: {
  integrationId: string;
  resourceName: string;
  resourceUri: string;
}) {
  const { data: integrations = [] } = useIntegrations();

  // Construct view key from integrationId and resourceName
  const viewKey = `${integrationId}:${resourceName}`;
  const ViewComponent =
    WELL_KNOWN_VIEWS[viewKey as keyof typeof WELL_KNOWN_VIEWS];

  // Find the connection for this integration
  const connection = useMemo(() => {
    return integrations.find((i) => i.id === integrationId)?.connection;
  }, [integrations, integrationId]);

  if (!ViewComponent) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Unknown view type: {viewKey}
      </div>
    );
  }

  return (
    <ResourceRouteProvider
      integrationId={integrationId}
      resourceName={resourceName}
      resourceUri={resourceUri}
      connection={connection}
    >
      <ViewComponent resourceUri={resourceUri} />
    </ResourceRouteProvider>
  );
}

function ResourceListView({
  nativeView,
  integrationId,
  resourceName,
}: {
  nativeView?: string;
  integrationId?: string;
  resourceName?: string;
}) {
  // Handle native views
  if (nativeView === "documents") {
    return <DocumentsResourceList />;
  }

  if (nativeView === "workflows") {
    return <WorkflowsResourceList />;
  }

  if (nativeView === "tools") {
    return <ToolsResourceList />;
  }

  if (nativeView === "views") {
    return <ViewsResourceList />;
  }

  if (nativeView === "agents") {
    return <AgentsResourceList />;
  }

  if (nativeView === "database") {
    return <DatabaseStudio />;
  }

  // Handle resource views
  if (integrationId && resourceName) {
    return (
      <ResourcesV2List
        integrationId={integrationId}
        resourceName={resourceName}
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      Invalid list configuration
    </div>
  );
}

function CustomViewWrapper({
  integrationId,
  viewName,
}: {
  integrationId: string;
  viewName: string;
}) {
  // Render custom integration view (legacy compatibility)
  // Provide params via context so ViewDetail can use useParams()
  return (
    <RouteParamsProvider params={{ integrationId, viewName }}>
      <ViewDetail />
    </RouteParamsProvider>
  );
}

function AppsListWrapper() {
  // Render the apps list page in a tab
  return <InstalledAppsList />;
}

function AppDetailWrapper({ appKey }: { appKey: string }) {
  // Render app detail page in a tab
  // Provide params via context so AppDetail can use useParams()
  return (
    <RouteParamsProvider params={{ appKey }}>
      <AppDetail />
    </RouteParamsProvider>
  );
}

function AgentsListWrapper() {
  // Render the agents list page in a tab
  return <AgentsResourceList />;
}

function AgentDetailWrapper({
  agentId,
  threadId,
}: {
  agentId: string;
  threadId: string;
}) {
  // Render agent detail page in a tab
  return <AgentEdit agentId={agentId} threadId={threadId} />;
}

function LegacyPromptDetailWrapper({ promptId }: { promptId: string }) {
  // Render legacy prompt detail page in a tab
  // Provide params via context so PromptDetail can use useParams()

  return (
    <RouteParamsProvider params={{ id: promptId }}>
      <LegacyPromptDetail />
    </RouteParamsProvider>
  );
}

function LegacyViewDetailWrapper({ viewId }: { viewId: string }) {
  // Parse viewId to get integrationId and viewName
  // Format: "{integrationId}/{viewName}"
  const [integrationId, viewName] = viewId.split("/");

  // Render legacy view detail page in a tab
  // Provide params via context so ViewDetail can use useParams()
  return (
    <RouteParamsProvider params={{ integrationId, viewName }}>
      <ViewDetail />
    </RouteParamsProvider>
  );
}

function LegacyWorkflowRunDetailWrapper({
  workflowName,
  runId,
}: {
  workflowName: string;
  runId: string;
}) {
  // Render legacy workflow run detail page in a tab
  // Provide params via context so WorkflowDetail can use useParams()
  return (
    <RouteParamsProvider params={{ workflowName, instanceId: runId }}>
      <WorkflowDetail />
    </RouteParamsProvider>
  );
}

function ThreadDetailWrapper({ threadId }: { threadId: string }) {
  // Render standalone thread conversation view in a tab
  // Fetch thread data and render ThreadConversation without navigation
  const { data: thread } = useThread(threadId);

  if (!thread) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  // Adapt thread data to match ThreadConversation's expected format
  const threadForConversation = {
    id: thread.id,
    title: thread.title,
    resourceId: thread.resourceId,
    metadata: thread.metadata || {},
  };

  return (
    <ThreadConversation
      thread={threadForConversation}
      onNavigate={() => {}} // No navigation in standalone view
      canNavigatePrevious={false}
      canNavigateNext={false}
    />
  );
}

function TriggerDetailWrapper({ triggerId }: { triggerId: string }) {
  // Render trigger detail page in a tab
  // Provide params via context so TriggerDetails can use useParams()
  return (
    <RouteParamsProvider params={{ id: triggerId }}>
      <TriggerDetails />
    </RouteParamsProvider>
  );
}

export function CanvasTabContent({ tab }: CanvasTabContentProps) {
  // Parse resourceUri to determine view type and data
  const parsed = useMemo(
    () => parseResourceUri(tab.resourceUri),
    [tab.resourceUri],
  );

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Spinner />
        </div>
      }
    >
      {/* Resource detail views */}
      {tab.type === "detail" && parsed.protocol === "rsc" ? (
        <ResourceDetailView
          integrationId={parsed.integrationId!}
          resourceName={parsed.resourceName!}
          resourceUri={tab.resourceUri}
        />
      ) : /* Native list views */
      tab.type === "list" && parsed.protocol === "native" ? (
        <ResourceListView nativeView={parsed.nativeView} />
      ) : /* Resource list views */
      tab.type === "list" && parsed.protocol === "rsc" ? (
        <ResourceListView
          integrationId={parsed.integrationId}
          resourceName={parsed.resourceName}
        />
      ) : /* Custom integration views (legacy compatibility) */
      tab.type === "list" && parsed.protocol === "view" ? (
        <CustomViewWrapper
          integrationId={parsed.integrationId!}
          viewName={parsed.viewName!}
        />
      ) : /* Apps list page */
      parsed.protocol === "apps" ? (
        <AppsListWrapper />
      ) : /* App detail page */
      parsed.protocol === "app" ? (
        <AppDetailWrapper appKey={parsed.appKey!} />
      ) : /* Agents list page */
      parsed.protocol === "agents" ? (
        <AgentsListWrapper />
      ) : /* Agent detail page */
      parsed.protocol === "agent" ? (
        <AgentDetailWrapper
          agentId={parsed.agentId!}
          threadId={parsed.threadId!}
        />
      ) : /* Legacy prompt detail page */
      parsed.protocol === "legacy-prompt" ? (
        <LegacyPromptDetailWrapper promptId={parsed.promptId!} />
      ) : /* Legacy view detail page */
      parsed.protocol === "legacy-view" ? (
        <LegacyViewDetailWrapper viewId={parsed.viewId!} />
      ) : /* Legacy workflow run detail page */
      parsed.protocol === "legacy-workflow-run" ? (
        <LegacyWorkflowRunDetailWrapper
          workflowName={parsed.workflowName!}
          runId={parsed.runId!}
        />
      ) : /* Thread detail page (standalone thread view) */
      parsed.protocol === "thread" ? (
        <ThreadDetailWrapper threadId={parsed.threadId!} />
      ) : /* Trigger detail page */
      parsed.protocol === "trigger" ? (
        <TriggerDetailWrapper triggerId={parsed.triggerId!} />
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Invalid tab configuration: {parsed.protocol}
        </div>
      )}
    </Suspense>
  );
}
