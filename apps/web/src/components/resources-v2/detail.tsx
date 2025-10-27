import { callTool, useIntegration, useTools } from "@deco/sdk";
import type { ReadOutput } from "@deco/sdk/mcp";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import { useParams } from "react-router";
import { z } from "zod";
import { EmptyState } from "../common/empty-state.tsx";
import { ReactViewRenderer } from "../views/react-view-registry.tsx";
import { ResourceRouteProvider } from "./route-context.tsx";
import { useSetThreadContextEffect } from "../decopilot/thread-context-provider.tsx";

// Base resource data schema that all resources extend
const BaseResourceDataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

// View response schema
interface ViewResponse {
  url: string;
  prompt?: string;
  tools?: string[];
  rules?: string[];
}

const ResourceDetailContext = createContext<
  ReadOutput<typeof BaseResourceDataSchema> | undefined
>(undefined);

interface ResourcesV2DetailTabProps {
  viewData: ViewResponse | undefined;
  viewIsLoading: boolean;
  viewError: Error | null;
}

function ResourcesV2DetailTab({
  viewData,
  viewIsLoading,
  viewError,
}: ResourcesV2DetailTabProps) {
  const readResponse = useContext(ResourceDetailContext);
  if (readResponse === undefined) {
    throw new Error(
      "ResourcesV2DetailTab must be used within ResourceDetailProvider",
    );
  }

  if (viewIsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (viewError || !viewData) {
    return (
      <EmptyState
        icon="error"
        title="Failed to load view"
        description={
          (viewError as Error)?.message || "No URL returned from view render"
        }
      />
    );
  }

  if (
    typeof viewData.url === "string" &&
    viewData.url?.startsWith("react://")
  ) {
    return <ReactViewRenderer url={viewData.url} />;
  }

  return (
    <div className="h-full">
      <iframe src={viewData.url} className="w-full h-full border-0" />
    </div>
  );
}

function ResourcesV2Detail() {
  const { integrationId, resourceName, resourceUri } = useParams();
  const integration = useIntegration(integrationId ?? "").data;
  const decodedUri = useMemo(
    () => (resourceUri ? decodeURIComponent(resourceUri) : undefined),
    [resourceUri],
  );

  const resourceReadQuery = useQuery({
    enabled: Boolean(integration && resourceName && decodedUri),
    queryKey: ["deco-resource-read", integrationId, resourceName, decodedUri],
    queryFn: async () => {
      const result = await callTool(integration!.connection, {
        name: `DECO_RESOURCE_${resourceName!.toUpperCase()}_READ`,
        arguments: { uri: decodedUri! },
      });
      return result.structuredContent as ReadOutput<
        typeof BaseResourceDataSchema
      >;
    },
    staleTime: 30_000,
  });

  // Get tools for the integration
  const toolsQuery = useTools(integration!.connection, false);
  const tools = toolsQuery?.data?.tools ?? [];

  // Find the single view render tool for the current resource
  const viewRenderTool = useMemo(() => {
    if (!resourceName) return undefined;
    const expected = `DECO_VIEW_RENDER_${resourceName.toUpperCase()}`;
    return tools.find((tool) => {
      if (!tool.name.startsWith(expected)) {
        return false;
      }

      const schema = tool.inputSchema || {};
      const props = (schema?.properties ?? {}) as Record<string, unknown>;
      const resourceProp =
        "resource" in props
          ? (props.resource as Record<string, unknown>)
          : undefined;

      return resourceProp?.type === "string";
    });
  }, [tools, resourceName]);

  // View render query - moved from ResourcesV2DetailTab
  const viewQuery = useQuery({
    queryKey: [
      "view-render-single",
      integrationId,
      decodedUri,
      viewRenderTool?.name,
    ],
    enabled: Boolean(integration && decodedUri && viewRenderTool),
    queryFn: async () => {
      const result = await callTool(integration!.connection, {
        name: viewRenderTool!.name,
        arguments: { resource: decodedUri! },
      });

      return result?.structuredContent as ViewResponse;
    },
  });

  // Show loading if ANY query is in initial load state (no cached data)
  // This creates a single, stable loading state instead of multiple flashing states
  const hasResourceData = Boolean(resourceReadQuery.data);
  const hasContextData = Boolean(toolsQuery.data);
  const hasViewData = Boolean(viewQuery.data || !viewRenderTool);

  // Wait for view query to complete so context is available immediately
  const isLoading =
    !hasResourceData ||
    !hasContextData ||
    !hasViewData ||
    (viewRenderTool && viewQuery.isLoading);

  const readError = resourceReadQuery.isError
    ? (resourceReadQuery.error as Error).message
    : null;
  const readResponse = resourceReadQuery.data;
  const viewResponse = viewQuery.data as ViewResponse | undefined;

  // Prepare thread context for resource detail
  const threadContextItems = useMemo(() => {
    if (!integrationId || !readResponse?.data) return [];

    const contextItems = [];

    // Add rule context items
    const rules: string[] = [
      `The current resource URI is: ${decodedUri ?? ""}. You can use resource tools to read, search, and work on this resource.`,
      `The current resource data is: ${JSON.stringify(readResponse?.data, null, 2)}. This contains the actual resource information that you can reference when helping the user.`,
      ...(viewResponse?.prompt ? [viewResponse.prompt] : []),
      ...(viewResponse?.rules ?? []),
    ];

    contextItems.push(
      ...rules.map((text) => ({
        id: crypto.randomUUID(),
        type: "rule" as const,
        text,
      })),
    );

    // Add toolset context item
    const allTools = viewResponse?.tools ?? [];
    if (allTools.length > 0) {
      contextItems.push({
        id: crypto.randomUUID(),
        type: "toolset" as const,
        integrationId,
        enabledTools: allTools,
      });
    }

    return contextItems;
  }, [integrationId, readResponse?.data, viewResponse, decodedUri]);

  // Inject context into the thread
  useSetThreadContextEffect(threadContextItems);

  return (
    <ResourceRouteProvider
      integrationId={integrationId}
      resourceName={resourceName}
      resourceUri={decodedUri}
      connection={integration?.connection}
    >
      <ResourceDetailContext.Provider value={readResponse}>
        {isLoading ? (
          <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
            <Spinner />
          </div>
        ) : readError ? (
          <EmptyState
            icon="error"
            title="Failed to load resource"
            description="An error occurred while loading the resource"
          />
        ) : !viewRenderTool ? (
          <EmptyState
            icon="view_carousel"
            title="No view render tool available"
            description="This integration doesn't have a view render tool."
          />
        ) : (
          <ResourcesV2DetailTab
            viewData={viewQuery.data}
            viewIsLoading={viewQuery.isLoading}
            viewError={viewQuery.error}
          />
        )}
      </ResourceDetailContext.Provider>
    </ResourceRouteProvider>
  );
}

export default ResourcesV2Detail;
