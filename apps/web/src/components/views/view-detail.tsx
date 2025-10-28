import {
  DECO_CMS_API_URL,
  useRecentResources,
  useSDK,
  useViewByUriV2,
  useUpdateView,
} from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import type { JSONSchema7 } from "json-schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import { Button } from "@deco/ui/components/button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { toast } from "sonner";
import { generateViewHTML } from "../../utils/view-template.ts";
import { PreviewIframe } from "../agent/preview.tsx";
import {
  appendRuntimeError,
  clearRuntimeError,
  type RuntimeErrorEntry,
} from "../chat/provider.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { ajvResolver } from "../json-schema/index.tsx";
import { generateDefaultValues } from "../json-schema/utils/generate-default-values.ts";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

interface ViewDetailProps {
  resourceUri: string;
  data?: unknown;
}

/**
 * View detail view with full-screen HTML preview
 * Displays the view HTML content in an iframe
 * @param resourceUri - The resource URI of the view to display
 * @param data - Optional data to inject into window.viewData for the view to access
 */
export function ViewDetail({ resourceUri, data }: ViewDetailProps) {
  const { org, project } = useParams<{ org: string; project: string }>();
  const { data: resource, isLoading } = useViewByUriV2(resourceUri);
  const effectiveView = resource?.data;
  const { locator } = useSDK();
  const projectKey = typeof locator === "string" ? locator : undefined;
  const { addRecent } = useRecentResources(projectKey);
  const hasTrackedRecentRef = useRef(false);
  const [isCodeViewerOpen, setIsCodeViewerOpen] = useState(false);
  const [codeDraft, setCodeDraft] = useState<string | undefined>(undefined);
  const updateViewMutation = useUpdateView();

  // Current code value = draft OR saved value
  const currentCode = codeDraft ?? effectiveView?.code ?? "";

  // isDirty = draft exists and differs from saved value
  const isDirty = codeDraft !== undefined && codeDraft !== effectiveView?.code;

  // Handlers for code editing
  const handleCodeChange = useCallback((value: string) => {
    setCodeDraft(value);
  }, []);

  const handleSaveCode = useCallback(async () => {
    if (!effectiveView) {
      toast.error("View not found");
      return;
    }

    try {
      await updateViewMutation.mutateAsync({
        uri: resourceUri,
        params: {
          name: effectiveView.name,
          description: effectiveView.description,
          code: currentCode,
          inputSchema: effectiveView.inputSchema,
          importmap: effectiveView.importmap,
          icon: effectiveView.icon,
          tags: effectiveView.tags,
        },
      });
      setCodeDraft(undefined);
      toast.success("View code updated successfully");
    } catch (error) {
      console.error("Failed to save view code:", error);
      toast.error("Failed to save view code");
    }
  }, [effectiveView, resourceUri, currentCode, updateViewMutation]);

  const handleResetCode = useCallback(() => {
    setCodeDraft(undefined);
  }, []);

  // Initialize form if view has inputSchema
  const inputSchema = effectiveView?.inputSchema as JSONSchema7 | undefined;
  const defaultValues = useMemo(() => {
    if (!inputSchema) return {};
    return generateDefaultValues(inputSchema);
  }, [inputSchema]);

  const form = useForm({
    // oxlint-disable-next-line no-explicit-any
    resolver: inputSchema ? ajvResolver(inputSchema as any) : undefined,
    defaultValues,
    mode: "onChange",
  });

  // Watch form values and pass to view
  const formValues = form.watch();
  const viewData = useMemo(() => {
    // If data prop is provided, use it; otherwise use form values
    return data ?? (inputSchema ? formValues : undefined);
  }, [data, formValues, inputSchema]);

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
  // Use currentCode (which includes draft) for preview
  const htmlValue = useMemo(() => {
    if (!currentCode || !org || !project) return null;

    try {
      return generateViewHTML(
        currentCode,
        DECO_CMS_API_URL,
        org,
        project,
        window.location.origin, // Pass current admin app origin as trusted origin
        effectiveView?.importmap,
      );
    } catch (error) {
      console.error("Failed to generate view HTML:", error);
      return null;
    }
  }, [currentCode, effectiveView?.importmap, org, project]);

  // Reference to iframe element for postMessage
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Send data to iframe when it loads or when data changes
  useEffect(() => {
    if (!iframeRef.current || viewData === undefined) return;

    const iframe = iframeRef.current;

    // Wait for iframe to load before sending data
    const sendData = () => {
      iframe.contentWindow?.postMessage(
        {
          type: "VIEW_DATA",
          payload: viewData,
        },
        "*",
      );
    };

    // If iframe is already loaded, send immediately
    if (iframe.contentWindow) {
      sendData();
    }

    // Also listen for load event in case it hasn't loaded yet
    iframe.addEventListener("load", sendData);

    return () => {
      iframe.removeEventListener("load", sendData);
    };
  }, [viewData]);

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
      {/* Header with code viewer toggle */}
      <div className="flex items-center justify-between px-2 h-10 border-b border-base-border">
        <h2 className="text-sm font-regular">{effectiveView.name}</h2>
        <div className="flex items-center gap-2">
          {isCodeViewerOpen && isDirty && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetCode}
                className="h-7 px-2 text-xs"
              >
                Reset
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSaveCode}
                className="h-7 px-3 text-xs gap-1"
                disabled={updateViewMutation.isPending}
              >
                <Icon name="check" size={14} />
                {updateViewMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </>
          )}
          {effectiveView.code && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 rounded-xl p-0",
                isCodeViewerOpen && "bg-accent text-accent-foreground",
              )}
              onClick={() => setIsCodeViewerOpen(!isCodeViewerOpen)}
              title="View Code"
            >
              <Icon
                name="code"
                size={20}
                className={
                  isCodeViewerOpen ? "text-foreground" : "text-muted-foreground"
                }
              />
            </Button>
          )}
        </div>
      </div>

      {/* Code Viewer Section - Shows when code button is clicked */}
      {isCodeViewerOpen && effectiveView.code ? (
        <div className="flex-1 overflow-hidden w-full">
          <CodeMirror
            value={currentCode}
            onChange={handleCodeChange}
            extensions={[javascript({ jsx: true, typescript: true })]}
            theme={oneDark}
            height="100%"
            className="h-full w-full text-sm"
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightSpecialChars: true,
              foldGutter: true,
              drawSelection: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
              syntaxHighlighting: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              rectangularSelection: true,
              crosshairCursor: true,
              highlightActiveLine: true,
              highlightSelectionMatches: true,
              closeBracketsKeymap: true,
              searchKeymap: true,
              foldKeymap: true,
              completionKeymap: true,
              lintKeymap: true,
            }}
          />
        </div>
      ) : (
        /* Preview Section - Shows when code viewer is closed */
        <div className="flex-1 overflow-hidden relative">
          {htmlValue ? (
            <PreviewIframe
              ref={iframeRef}
              srcDoc={htmlValue}
              title="View Preview"
              className="w-full h-full border-0"
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
      )}
    </div>
  );
}

export default ViewDetail;
