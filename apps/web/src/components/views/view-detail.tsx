import {
  DECO_CMS_API_URL,
  useRecentResources,
  useSDK,
  useViewByUriV2,
} from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router";
import { generateViewHTML } from "../../utils/view-template.ts";
import { PreviewIframe } from "../agent/preview.tsx";
import {
  appendRuntimeError,
  clearRuntimeError,
  type RuntimeErrorEntry,
} from "../chat/provider.tsx";
import { EmptyState } from "../common/empty-state.tsx";

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

  // Listen for messages from iframe (Fix with AI and Runtime Errors)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Validate message structure
      if (!event.data || !event.data.type) {
        return;
      }

      // Handle Runtime Error messages
      if (event.data.type === "RUNTIME_ERROR") {
        const errorData = event.data.payload as RuntimeErrorEntry;
        appendRuntimeError(
          { ...errorData, type: "Runtime Error" },
          resourceUri,
          effectiveView?.name,
        );
      }

      // Handle Resource Error messages
      if (event.data.type === "RESOURCE_ERROR") {
        const errorData = event.data.payload as RuntimeErrorEntry;
        appendRuntimeError(
          { ...errorData, type: "Resource Error" },
          resourceUri,
          effectiveView?.name,
        );
      }

      // Handle Unhandled Promise Rejection messages
      if (event.data.type === "UNHANDLED_REJECTION") {
        const errorData = event.data.payload as RuntimeErrorEntry;
        appendRuntimeError(
          { ...errorData, type: "Unhandled Rejection" },
          resourceUri,
          effectiveView?.name,
        );
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [resourceUri, effectiveView?.name]);

  // Clear errors when view changes
  useEffect(() => {
    clearRuntimeError();
  }, [resourceUri]);

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
      <div className="h-full flex items-center justify-center">
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
    <div className="h-full w-full flex flex-col bg-white">
      {/* Preview Section - Full Container */}
      <div className="flex-1 overflow-hidden relative">
        {htmlValue ? (
          <PreviewIframe
            srcDoc={htmlValue}
            title="View Preview"
            className="w-full h-full border-0 rounded-lg"
          />
        ) : (
          <div className="flex items-center justify-center h-full p-8">
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
