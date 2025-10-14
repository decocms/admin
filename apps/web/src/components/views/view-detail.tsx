import {
  DECO_CMS_API_URL,
  useViewByUriV2,
  useSDK,
  useRecentResources,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useParams } from "react-router";
import { PreviewIframe } from "../agent/preview.tsx";
import { generateViewHTML } from "../../utils/view-template.ts";

interface ViewDetailProps {
  resourceUri: string;
}

/**
 * View detail view with full-screen HTML preview
 * Displays the view HTML content in an iframe
 */
export function ViewDetail({ resourceUri }: ViewDetailProps) {
  const { org, project } = useParams<{ org: string; project: string }>();
  const {
    data: resource,
    isLoading: isLoading,
    refetch,
  } = useViewByUriV2(resourceUri);
  const effectiveView = resource?.data;
  const { locator } = useSDK();
  const projectKey = typeof locator === "string" ? locator : undefined;
  const { addRecent } = useRecentResources(projectKey);
  const hasTrackedRecentRef = useRef(false);

  // Track as recently opened when view is loaded (only once)
  useEffect(() => {
    if (
      effectiveView &&
      resourceUri &&
      projectKey &&
      org &&
      project &&
      !hasTrackedRecentRef.current
    ) {
      hasTrackedRecentRef.current = true;
      // Parse the resource URI to extract integration and resource name
      // Format: rsc://integration-id/resource-name/resource-id
      const uriWithoutPrefix = resourceUri.replace("rsc://", "");
      const [integrationId, resourceName] = uriWithoutPrefix.split("/");

      addRecent({
        id: resourceUri,
        name: effectiveView.name,
        type: "view",
        icon: "visibility",
        path: `/${projectKey}/rsc/i:${integrationId}/${resourceName}/${encodeURIComponent(resourceUri)}`,
      });
    }
  }, [effectiveView, resourceUri, projectKey, org, project, addRecent]);

  // Local loading state for refresh functionality
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch]);

  // Generate HTML from React code on the client side
  const htmlValue = useMemo(() => {
    if (!effectiveView?.code || !org || !project) return null;

    try {
      return generateViewHTML(
        effectiveView.code,
        DECO_CMS_API_URL,
        org,
        project,
        effectiveView.importmap,
      );
    } catch (error) {
      console.error("Failed to generate view HTML:", error);
      return null;
    }
  }, [effectiveView?.code, effectiveView?.importmap, org, project]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!effectiveView) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Icon
            name="error"
            className="w-12 h-12 mx-auto mb-4 text-muted-foreground"
          />
          <p className="text-lg font-medium">View not found</p>
          <p className="text-sm text-muted-foreground mt-2">
            The view could not be loaded. It may have been deleted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="visibility" className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">{effectiveView.name}</h1>
              {effectiveView.description && (
                <p className="text-sm text-muted-foreground">
                  {effectiveView.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <Icon name="refresh" className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {htmlValue ? (
          <PreviewIframe
            srcDoc={htmlValue}
            title="View Preview"
            className="w-full h-full border-0"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Icon
                name="visibility_off"
                className="w-12 h-12 mx-auto mb-4 text-muted-foreground"
              />
              <p className="text-sm text-muted-foreground">
                No React code to preview
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ViewDetail;
