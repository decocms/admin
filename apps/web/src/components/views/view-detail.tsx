import {
  DECO_CMS_API_URL,
  useViewByUriV2,
  useSDK,
  useRecentResources,
} from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useMemo, useEffect, useRef } from "react";
import { useParams } from "react-router";
import { EmptyState } from "../common/empty-state.tsx";
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
  const { data: resource, isLoading } = useViewByUriV2(resourceUri);
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

      // Use setTimeout to ensure this runs after render
      setTimeout(() => {
        addRecent({
          id: resourceUri,
          name: effectiveView.name,
          type: "view",
          icon: "dashboard",
          path: `/${projectKey}/rsc/${integrationId.startsWith("i:") ? integrationId : `i:${integrationId}`}/${resourceName}/${encodeURIComponent(resourceUri)}`,
        });
      }, 0);
    }
  }, [effectiveView, resourceUri, projectKey, org, project, addRecent]);

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
      <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!effectiveView) {
    return (
      <EmptyState
        icon="error"
        title="View not found"
        description="The requested view could not be found or is not available."
      />
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border py-4 px-4 md:py-8 md:px-8 lg:py-16 lg:px-16 shrink-0">
        <div className="max-w-[1500px] mx-auto">
          <div>
            <h1 className="text-2xl font-medium">{effectiveView.name}</h1>
            {effectiveView.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {effectiveView.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Preview Section - Full Container */}
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
                size={48}
                className="mx-auto mb-4 text-muted-foreground"
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
