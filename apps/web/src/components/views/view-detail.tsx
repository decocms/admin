import {
  DECO_CMS_API_URL,
  useViewByUriV2,
  useSDK,
  useRecentResources,
} from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { useMemo, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { EmptyState } from "../common/empty-state.tsx";
import { PreviewIframe } from "../agent/preview.tsx";
import { generateViewHTML } from "../../utils/view-template.ts";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";

interface ViewDetailProps {
  resourceUri: string;
}

interface RuntimeError {
  message: string;
  timestamp: string;
  source?: string;
  line?: number;
  column?: number;
  stack?: string;
  name: string;
  type?: string;
  target?: string;
  reason?: unknown;
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
  const { setOpen: setDecopilotOpen } = useDecopilotOpen();

  // Track runtime errors from iframe
  const [runtimeErrors, setRuntimeErrors] = useState<RuntimeError[]>([]);

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

      // Handle Fix with AI messages
      if (event.data.type === "FIX_WITH_AI") {
        const { message, context } = event.data.payload || {};

        if (typeof message !== "string") {
          console.error("Invalid FIX_WITH_AI message:", event.data);
          return;
        }

        // Open the decopilot chat panel
        setDecopilotOpen(true);

        // Dispatch custom event for the chat provider to handle
        window.dispatchEvent(
          new CustomEvent("decopilot:sendMessage", {
            detail: { message, context },
          }),
        );
      }

      // Handle Runtime Error messages
      if (event.data.type === "RUNTIME_ERROR") {
        const errorData = event.data.payload as RuntimeError;
        setRuntimeErrors((prev) => [...prev, { ...errorData, type: "Runtime Error" }]);
      }

      // Handle Resource Error messages
      if (event.data.type === "RESOURCE_ERROR") {
        const errorData = event.data.payload as RuntimeError;
        setRuntimeErrors((prev) => [...prev, { ...errorData, type: "Resource Error" }]);
      }

      // Handle Unhandled Promise Rejection messages
      if (event.data.type === "UNHANDLED_REJECTION") {
        const errorData = event.data.payload as RuntimeError;
        setRuntimeErrors((prev) => [...prev, { ...errorData, type: "Unhandled Rejection" }]);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setDecopilotOpen]);

  // Reset runtime errors when view changes
  useEffect(() => {
    setRuntimeErrors([]);
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

  // Handle fix errors button click
  function handleFixErrors() {
    if (runtimeErrors.length === 0) return;

    // Format errors into a readable message
    const errorSummary = runtimeErrors
      .map((error, index) => {
        const location = error.source
          ? `\n  Source: ${error.source}:${error.line}:${error.column}`
          : "";
        const stack = error.stack ? `\n  Stack: ${error.stack}` : "";
        return `${index + 1}. [${error.type || error.name}] ${error.message}${location}${stack}`;
      })
      .join("\n\n");

    const message = `The view "${effectiveView?.name || "unknown"}" is encountering ${runtimeErrors.length} runtime error${runtimeErrors.length > 1 ? "s" : ""}:\n\n${errorSummary}\n\nPlease help fix these errors in the view code.`;

    // Open the decopilot chat panel
    setDecopilotOpen(true);

    // Send message to chat
    window.dispatchEvent(
      new CustomEvent("decopilot:sendMessage", {
        detail: {
          message,
          context: {
            errorType: "runtime_errors",
            viewUri: resourceUri,
            viewName: effectiveView?.name,
            errorCount: runtimeErrors.length,
            errors: runtimeErrors,
          },
        },
      }),
    );
  }

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
      {/* Preview Section - Full Container */}
      <div className="flex-1 overflow-hidden relative">
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

        {/* Error Fix Button - Fixed Position */}
        {runtimeErrors.length > 0 && (
          <div className="absolute bottom-4 right-4">
            <Button
              onClick={handleFixErrors}
              variant="destructive"
              size="lg"
              className="shadow-lg relative"
            >
              <Icon name="bug_report" className="mr-2" size={20} />
              Fix Errors with AI
              <Badge
                variant="secondary"
                className="ml-2 bg-white text-destructive hover:bg-white"
              >
                {runtimeErrors.length}
              </Badge>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ViewDetail;
