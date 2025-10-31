import {
  DECO_CMS_API_URL,
  useRecentResources,
  useSDK,
  useViewByUriV2,
  useUpdateView,
  useWriteFile,
} from "@deco/sdk";
import { Hosts } from "@deco/sdk/hosts";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import type { JSONSchema7 } from "json-schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
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
import {
  ResourceDetailHeader,
  CodeAction,
  SaveDiscardActions,
} from "../common/resource-detail-header.tsx";
import {
  ViewConsole,
  useConsoleState,
  ViewConsoleProvider,
} from "./view-console.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import { useTheme } from "../theme.tsx";
import { useAgenticChat } from "../chat/provider.tsx";
import { UIMessage } from "@ai-sdk/react";
import html2canvas from "html2canvas";

interface ViewDetailProps {
  resourceUri: string;
  data?: unknown;
}

function ConsoleToggleButton({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const consoleState = useConsoleState();
  const errorCount = consoleState?.errorCount ?? 0;
  const warningCount = consoleState?.warningCount ?? 0;

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={onToggle}
      className={`size-6 p-0 relative ${isOpen ? "bg-accent" : ""}`}
      title="Toggle Console"
    >
      <Icon
        name="terminal"
        className={isOpen ? "text-foreground" : "text-muted-foreground"}
      />
      {errorCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute bottom-1 right-0.5 size-2 flex items-center justify-center p-0 text-[10px] rounded-full outline-2 outline-sidebar outline-solid"
        ></Badge>
      )}
      {warningCount > 0 && errorCount === 0 && (
        <Badge
          variant="destructive"
          className="absolute bottom-1 right-0.5 size-2 flex items-center justify-center p-0 text-[10px] rounded-full outline-2 outline-sidebar outline-solid bg-yellow-500"
        ></Badge>
      )}
    </Button>
  );
}

function SendLogsButton() {
  const consoleState = useConsoleState();
  const { logs } = consoleState ?? { logs: [] };

  const formatTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }, []);

  const handleSendLogs = useCallback(() => {
    if (logs.length === 0) {
      toast.info("No console logs to send");
      return;
    }

    // Format logs as text
    const logText = logs
      .map((log) => {
        const time = formatTime(log.timestamp);
        const source = log.source
          ? ` [${log.source}:${log.line}:${log.column}]`
          : "";
        const stack = log.stack ? `\n${log.stack}` : "";
        return `[${time}] ${log.type.toUpperCase()}: ${log.message}${source}${stack}`;
      })
      .join("\n\n");

    // Add logs to chat context
    window.dispatchEvent(
      new CustomEvent("decopilot:addLogs", {
        detail: { logs: logText },
      }),
    );
    toast.success("Console logs added to chat");
  }, [logs, formatTime]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={handleSendLogs}
      className="size-6 p-0"
      title="Send Console Logs to Chat"
    >
      <Icon name="description" className="text-muted-foreground" />
    </Button>
  );
}

function SendScreenshotButton({
  iframeRef,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const [isSending, setIsSending] = useState(false);
  const { locator } = useSDK();
  const writeFileMutation = useWriteFile();

  const handleSendScreenshot = useCallback(async () => {
    if (!iframeRef.current) {
      toast.error("Unable to capture screenshot.");
      return;
    }

    setIsSending(true);

    try {
      // Capture screenshot of the iframe's content
      const iframe = iframeRef.current;
      const iframeDocument =
        iframe.contentDocument || iframe.contentWindow?.document;

      if (!iframeDocument) {
        throw new Error("Unable to access iframe content");
      }

      // Capture the iframe's body
      const canvas = await html2canvas(iframeDocument.body, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create screenshot blob"));
          }
        }, "image/png");
      });

      // Upload the screenshot
      const timestamp = Date.now();
      const filename = `view-screenshot-${timestamp}.png`;
      const path = `uploads/${filename}`;
      const buffer = await blob.arrayBuffer();

      await writeFileMutation.mutateAsync({
        path,
        contentType: "image/png",
        content: new Uint8Array(buffer),
      });

      const screenshotUrl = `https://${Hosts.API_LEGACY}/files/${locator}/${path}`;

      // Add screenshot to chat context (without logs)
      window.dispatchEvent(
        new CustomEvent("decopilot:addScreenshot", {
          detail: {
            file: {
              name: filename,
              type: "image/png",
              size: blob.size,
            },
            url: screenshotUrl,
          },
        }),
      );
      toast.success("Screenshot added to chat");
    } catch (error) {
      console.error("Failed to send screenshot:", error);
      toast.error(
        error instanceof Error
          ? `Failed to send screenshot: ${error.message}`
          : "Failed to send screenshot",
      );
    } finally {
      setIsSending(false);
    }
  }, [iframeRef, writeFileMutation, locator]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={handleSendScreenshot}
      disabled={isSending}
      className="size-6 p-0"
      title="Send Screenshot to Chat"
    >
      {isSending ? (
        <div className="size-3">
          <Spinner />
        </div>
      ) : (
        <Icon name="photo_camera" className="text-muted-foreground" />
      )}
    </Button>
  );
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

  // Persist console open state
  const { value: isConsoleOpen, update: setIsConsoleOpen } = useLocalStorage({
    key: "deco-view-console-open",
    defaultValue: false,
  });

  const updateViewMutation = useUpdateView();
  const { data: theme } = useTheme();
  const [themeUpdateTrigger, setThemeUpdateTrigger] = useState(0);

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

  // Define trusted origins for secure postMessage handling
  const trustedOrigins = useMemo(() => {
    const origins = new Set<string>();

    // Add the app's own origin
    if (typeof window !== "undefined") {
      origins.add(window.location.origin);
    }

    // Allow null origin for sandboxed iframes with srcdoc
    origins.add("null");

    return origins;
  }, []);

  // Listen for messages from iframe (Fix with AI and Runtime Errors)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Validate origin before processing any message data
      const isTrustedOrigin =
        trustedOrigins.has(event.origin) ||
        (typeof window !== "undefined" &&
          event.origin === window.location.origin);

      if (!isTrustedOrigin) {
        console.warn("Rejected message from untrusted origin:", event.origin);
        return;
      }

      // Validate event source
      if (!event.source || typeof event.source !== "object") {
        return;
      }

      // Now safe to access event.data
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
  }, [resourceUri, effectiveView?.name, trustedOrigins]);

  // Clear errors when view changes
  useEffect(() => {
    clearRuntimeError();
  }, [resourceUri]);

  // Listen for theme updates and trigger view regeneration
  useEffect(() => {
    const handleThemeUpdate = () => {
      setThemeUpdateTrigger((prev) => prev + 1);
    };

    window.addEventListener("theme-updated", handleThemeUpdate);
    return () => {
      window.removeEventListener("theme-updated", handleThemeUpdate);
    };
  }, []);

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
        theme?.variables as Record<string, string> | undefined,
      );
    } catch (error) {
      console.error("Failed to generate view HTML:", error);
      return null;
    }
  }, [
    currentCode,
    effectiveView?.importmap,
    org,
    project,
    theme?.variables,
    themeUpdateTrigger,
  ]);

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
    <ViewConsoleProvider>
      <div className="h-full w-full flex flex-col bg-white relative">
        {/* Header with code viewer toggle */}
        <ResourceDetailHeader
          title={effectiveView.name}
          actions={
            <>
              {isCodeViewerOpen && (
                <SaveDiscardActions
                  hasChanges={isDirty}
                  onSave={handleSaveCode}
                  onDiscard={handleResetCode}
                  isSaving={updateViewMutation.isPending}
                  discardLabel="Reset"
                />
              )}
              <SendLogsButton />
              <SendScreenshotButton iframeRef={iframeRef} />
              <ConsoleToggleButton
                isOpen={isConsoleOpen}
                onToggle={() => setIsConsoleOpen(!isConsoleOpen)}
              />
              <CodeAction
                isOpen={isCodeViewerOpen}
                onToggle={() => setIsCodeViewerOpen(!isCodeViewerOpen)}
                hasCode={!!effectiveView.code}
              />
            </>
          }
        />

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
          <div className="flex-1 overflow-hidden relative flex flex-col">
            <div
              className={`flex-1 overflow-hidden ${isConsoleOpen ? "flex-none" : ""}`}
              style={
                isConsoleOpen ? { height: "calc(100% - 24rem)" } : undefined
              }
            >
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

            {/* Console - Shows when preview is active */}
            <ViewConsole
              isOpen={isConsoleOpen}
              onClose={() => setIsConsoleOpen(false)}
            />
          </div>
        )}
      </div>
    </ViewConsoleProvider>
  );
}

export default ViewDetail;
