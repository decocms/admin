import {
  useCreateSecret,
  useIntegrations,
  useSecrets,
  type Integration,
} from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { ToolUIPart } from "ai";
import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useCopy } from "../../hooks/use-copy.ts";
import { ErrorBoundary } from "../../error-boundary.tsx";
import {
  truncateHash,
  useGetVersions,
  useRevertToVersion,
} from "../../stores/resource-version-history/index.ts";
import { extractResourceUriFromInput } from "../../stores/resource-version-history/utils.ts";
import {
  extractResourceUri,
  openResourceTab,
} from "../../utils/resource-tabs.ts";
import {
  extractToolName,
  getStatusStyles,
  parseToolName,
  resolveFullIntegrationId,
} from "../../utils/tool-namespace.ts";
import { useThread } from "../decopilot/thread-provider.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import { JsonViewer } from "./json-viewer.tsx";
import {
  HostingAppDeploy,
  HostingAppToolLike,
} from "./tools/hosting-app-deploy.tsx";
import { Preview } from "./tools/render-preview.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";

// Map ToolUIPart state to ToolLike state for custom UI components
const mapToToolLikeState = (
  state: ToolUIPart["state"],
): "call" | "result" | "error" | "partial-call" => {
  switch (state) {
    case "input-streaming":
    case "input-available":
      return "call";
    case "output-available":
      return "result";
    case "output-error":
      return "error";
    default:
      return "call";
  }
};

interface ToolMessageProps {
  part: ToolUIPart;
}

// Tools that have custom UI rendering and shouldn't show in the timeline
const CUSTOM_UI_TOOLS = new Set([
  "HOSTING_APP_DEPLOY",
  "RENDER",
  "GENERATE_IMAGE",
  "DECO_RESOURCE_MCP_READ",
  "DECO_RESOURCE_MCP_STORE_SEARCH",
  "CALL_TOOL",
  "SECRETS_PROMPT_USER",
]);

// Helper to extract toolName from ToolUIPart (handles both static and dynamic tools)
function getToolName(part: ToolUIPart): string {
  let rawToolName: string;

  if ("toolName" in part && typeof part.toolName === "string") {
    rawToolName = part.toolName;
  } else if (part.type.startsWith("tool-")) {
    // Extract from type: "tool-TOOL_NAME" -> "TOOL_NAME"
    rawToolName = part.type.substring(5);
  } else {
    return "UNKNOWN_TOOL";
  }

  // Parse namespaced tool name to extract just the tool name for display
  return extractToolName(rawToolName);
}

// Hook to memoize tool name extraction
function useToolName(part: ToolUIPart): string {
  const toolNameProp = "toolName" in part ? part.toolName : undefined;
  return useMemo(() => getToolName(part), [part.type, toolNameProp]);
}

function isCustomUITool(toolName: string): boolean {
  return CUSTOM_UI_TOOLS.has(toolName);
}

// Hook to memoize custom UI tool check
function useIsCustomUITool(part: ToolUIPart): boolean {
  const toolName = useToolName(part);
  return useMemo(() => isCustomUITool(toolName), [toolName]);
}

// Helper to check if tool has output (including errors)
function hasToolOutput(state: ToolUIPart["state"]): boolean {
  return state === "output-available" || state === "output-error";
}

// Helper to get status text from tool state
function getStatusText(state: ToolUIPart["state"]): string {
  switch (state) {
    case "input-streaming":
      return "Generating input...";
    case "input-available":
      return "Executing...";
    case "output-available":
      return "Done";
    case "output-error":
      return "Error";
    default:
      return "Unknown";
  }
}

// Helper to check if tool is loading
function isToolLoading(state: ToolUIPart["state"]): boolean {
  return state === "input-streaming" || state === "input-available";
}

// Helper to find integration by ID
function useIntegrationById(
  integrationId: string | null | undefined,
): Integration | null {
  const { data: integrations = [] } = useIntegrations();
  return useMemo(() => {
    if (!integrationId) return null;
    return integrations.find((i) => i.id === integrationId) ?? null;
  }, [integrationId, integrations]);
}

// Helper to create integration icon component
function createIntegrationIcon(
  integration: Integration | null,
  fallbackIcon: string = "folder",
): string | ReactNode {
  if (!integration) return fallbackIcon;
  return (
    <div className="w-5 flex items-center justify-center shrink-0">
      <IntegrationIcon
        icon={integration.icon}
        name={integration.name}
        size="xs"
        className="shrink-0"
      />
    </div>
  );
}

// Helper to render icon element (string or ReactNode)
function renderIcon(icon: string | ReactNode | undefined): ReactNode {
  if (!icon) return null;
  return typeof icon === "string" ? (
    <div className="w-5 flex items-center justify-center shrink-0">
      <Icon name={icon} size={16} />
    </div>
  ) : (
    icon
  );
}

// Reusable accordion component for tool calls with custom UI and debug view switcher
interface ToolCallDetailProps {
  part: ToolUIPart;
  icon?: string | ReactNode;
  title: string | ReactNode;
  children?: ReactNode;
  statusBadge?: ReactNode;
  defaultShowCustomView?: boolean;
  defaultExpanded?: boolean;
  headerActions?: ReactNode;
  onHeaderClick?: () => void;
  showDebugToggle?: boolean; // Whether to show the debug toggle icon
}

function ToolCallDetail({
  part,
  icon,
  title,
  children,
  statusBadge,
  defaultShowCustomView = true,
  defaultExpanded = false,
  headerActions,
  onHeaderClick,
  showDebugToggle,
}: ToolCallDetailProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showCustomView, setShowCustomView] = useState(defaultShowCustomView);
  const [isHovered, setIsHovered] = useState(false);
  const [showGradient, setShowGradient] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const statusText = getStatusText(part.state);
  const statusConfig = useMemo(() => getStatusStyles(part.state), [part.state]);
  const isLoading = isToolLoading(part.state);
  const hasOutput = hasToolOutput(part.state);

  // Only show debug toggle if there's custom UI content to toggle
  // If showDebugToggle is explicitly set (true/false), use that
  // Otherwise, only show if children exist
  const hasCustomUI = children !== null && children !== undefined;
  const shouldShowDebugToggle =
    showDebugToggle !== undefined ? showDebugToggle : hasCustomUI;

  // Check if scrolling is needed for gradient
  useEffect(() => {
    if (!isExpanded || !contentRef.current) {
      setShowGradient(false);
      return;
    }

    const checkScroll = () => {
      if (contentRef.current) {
        setShowGradient(
          contentRef.current.scrollHeight > contentRef.current.clientHeight,
        );
      }
    };

    checkScroll();

    // Guard ResizeObserver usage
    let resizeObserver: ResizeObserver | undefined;
    if (
      typeof window !== "undefined" &&
      typeof window.ResizeObserver !== "undefined"
    ) {
      resizeObserver = new ResizeObserver(checkScroll);
      resizeObserver.observe(contentRef.current);
    }

    const currentRef = contentRef.current;
    currentRef.addEventListener("scroll", checkScroll);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      currentRef?.removeEventListener("scroll", checkScroll);
    };
  }, [isExpanded, children]);

  const handleClick = useCallback(() => {
    if (onHeaderClick) {
      onHeaderClick();
      return;
    }
    setIsExpanded((prev) => {
      const newState = !prev;
      setTimeout(() => {
        if (newState && contentRef.current) {
          contentRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);
      return newState;
    });
  }, [onHeaderClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        if (e.key === " ") {
          e.preventDefault();
        }
        handleClick();
      }
    },
    [handleClick],
  );

  const iconElement = renderIcon(icon);
  const showChevron = isHovered || isExpanded;
  const chevronIcon = isExpanded ? "expand_more" : "chevron_right";

  return (
    <div
      className="flex flex-col relative hover:bg-accent/50 rounded-lg overflow-hidden max-w-4xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full flex items-center gap-2 text-sm text-muted-foreground transition-colors cursor-pointer hover:text-foreground py-1 px-1.5 h-10",
        )}
      >
        {showChevron ? (
          <div className="w-5 flex items-center justify-center shrink-0">
            <Icon name={chevronIcon} size={16} />
          </div>
        ) : (
          iconElement
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div
                className={cn(
                  "font-medium truncate",
                  isLoading && "text-shimmer",
                )}
              >
                {title}
              </div>
              {!(hasOutput && showCustomView && statusBadge) && (
                <div
                  className={cn(
                    "text-xs opacity-70 shrink-0",
                    statusConfig.className,
                  )}
                >
                  {statusText}
                </div>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1">
              {hasOutput && showCustomView && statusBadge && (
                <div className="text-xs text-muted-foreground/70">
                  {statusBadge}
                </div>
              )}
              {headerActions}
              {!onHeaderClick && shouldShowDebugToggle && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCustomView((prev) => !prev);
                        }}
                      >
                        <Icon
                          name="code"
                          className={cn(
                            "text-muted-foreground",
                            showCustomView && "text-foreground",
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span>
                        {showCustomView ? "Show debug view" : "Show custom UI"}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
      </div>

      {!onHeaderClick && (
        <div className="relative">
          <div
            ref={contentRef}
            className={cn(
              "text-left w-full min-w-0 transition-all duration-200 ease-in-out",
              isExpanded
                ? "max-h-[400px] opacity-100 overflow-y-auto"
                : "max-h-0 m-0 opacity-0 overflow-hidden",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {hasCustomUI && showCustomView ? (
              children
            ) : (
              <ToolDebugView part={part} />
            )}
          </div>
          {showGradient && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-background to-transparent pointer-events-none z-10" />
          )}
        </div>
      )}
    </div>
  );
}

// Reusable component for displaying raw input/output/error (debug mode)
// Always renders raw JSON format, never custom UI
function ToolDebugView({ part }: { part: ToolUIPart }) {
  const { state, input, output, errorText } = part;
  const hasOutput = hasToolOutput(state);
  const hasError = state === "output-error";

  return (
    <div className="text-left space-y-3 w-full min-w-0 h-full p-2 max-h-[400px] overflow-y-auto">
      {/* Input Section */}
      {input !== undefined && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
            <Icon name="arrow_downward" className="size-3" />
            Input
          </div>
          <JsonViewer data={input} defaultView="tree" maxHeight="100%" />
        </div>
      )}

      {/* Output Section - Always show if output exists, even on error */}
      {hasOutput && output !== undefined && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
            <Icon name="arrow_upward" className="size-3" />
            Output
          </div>
          <JsonViewer data={output} defaultView="tree" maxHeight="100%" />
        </div>
      )}

      {/* Error Section - Additional info, not a replacement for output */}
      {hasError && errorText && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-destructive px-1 flex items-center gap-2">
            <Icon name="error_outline" className="size-3" />
            Error Message
          </div>
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
            {errorText}
          </div>
        </div>
      )}
    </div>
  );
}

// Resource Tool Custom UI - simple card showing resource name, URI, and open button
function ResourceToolCustomUI({
  part,
  resourceUri,
  onOpenResource,
}: {
  part: ToolUIPart;
  resourceUri: string;
  onOpenResource: () => void;
}) {
  const hasOutput = part.state === "output-available";

  // Extract resource name from URI (last part after the last slash)
  // Must be called unconditionally before any early returns (React hooks rules)
  const resourceName = useMemo(() => {
    const parts = resourceUri.split("/");
    const lastPart = parts[parts.length - 1];
    // Remove file extension if present and format
    return lastPart.replace(/\.(ts|tsx|js|jsx)$/, "").replace(/_/g, " ");
  }, [resourceUri]);

  if (!hasOutput) {
    return null;
  }

  return (
    <div className="px-2 py-2">
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
        <div className="flex-1 min-w-0 mr-3">
          <div className="text-sm font-medium text-foreground truncate">
            {resourceName}
          </div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {resourceUri}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onOpenResource();
          }}
          className="h-8 gap-1.5 shrink-0"
        >
          <Icon name="open_in_new" size={14} />
          Open
        </Button>
      </div>
    </div>
  );
}

const ToolStatus = memo(function ToolStatus({ part }: { part: ToolUIPart }) {
  const { input } = part;

  // Get raw tool name to parse integration ID
  const rawToolName = useMemo(() => {
    if ("toolName" in part && typeof part.toolName === "string") {
      return part.toolName;
    }
    if (part.type.startsWith("tool-")) {
      return part.type.substring(5);
    }
    return null;
  }, [part]);

  const toolName = useToolName(part);
  const { data: integrations = [] } = useIntegrations();

  // Check if this is a DECO_RESOURCE_* tool
  const isResourceTool = useMemo(() => {
    if (!rawToolName) return false;
    return /^DECO_RESOURCE_.*_(CREATE|READ|UPDATE|DELETE|SEARCH)$/.test(
      extractToolName(rawToolName),
    );
  }, [rawToolName]);

  // Extract resource URI for DECO_RESOURCE_* tools
  const resourceUri = useMemo(() => {
    if (!isResourceTool) return null;

    const toolInput = part.input;
    const isCreateOperation = /^DECO_RESOURCE_.*_CREATE$/.test(
      extractToolName(rawToolName || ""),
    );

    // For CREATE operations, URI is in output
    if (isCreateOperation && part.state === "output-available") {
      const output = part.output as
        | { structuredContent?: { uri?: string; data?: unknown } }
        | { uri?: string; data?: unknown }
        | undefined;
      // Check for structuredContent first
      if (output && typeof output === "object") {
        const withStructuredContent = output as {
          structuredContent?: { uri?: string; data?: unknown };
        };
        if (
          "structuredContent" in withStructuredContent &&
          withStructuredContent.structuredContent
        ) {
          return withStructuredContent.structuredContent.uri || null;
        }
        // Fall back to direct uri property
        if ("uri" in output && typeof output.uri === "string") {
          return output.uri;
        }
      }
    }

    // For other operations (READ, UPDATE, DELETE, SEARCH), URI is in input
    if (!isCreateOperation && toolInput) {
      // Use extractResourceUri for UPDATE/CREATE (handles both), otherwise extract from input directly
      const uri = extractResourceUri(toolName, toolInput, undefined);
      if (uri) return uri;
      // Fallback to direct extraction for READ, DELETE, SEARCH
      return extractResourceUriFromInput(toolInput);
    }

    return null;
  }, [
    isResourceTool,
    toolName,
    rawToolName,
    part.input,
    part.state,
    part.output,
  ]);

  // Canvas tabs management for resource tools
  const { tabs, addTab, setActiveTab } = useThread();

  // Handle opening resource in tab
  const handleResourceClick = useCallback(() => {
    if (resourceUri) {
      openResourceTab(resourceUri, tabs, integrations, addTab, setActiveTab);
    }
  }, [resourceUri, tabs, integrations, addTab, setActiveTab]);

  // Parse integration ID from namespaced tool name
  const truncatedIntegrationId = useMemo(() => {
    if (!rawToolName) return null;
    const parsed = parseToolName(rawToolName);
    return parsed?.integrationId ?? null;
  }, [rawToolName]);

  // Resolve full integration ID from truncated version
  const integrationId = useMemo(() => {
    if (!truncatedIntegrationId) return null;
    const availableIds = integrations.map((i) => i.id);
    return resolveFullIntegrationId(truncatedIntegrationId, availableIds);
  }, [truncatedIntegrationId, integrations]);

  // Find matching integration
  const integration = useMemo(() => {
    if (!integrationId) return null;
    return integrations.find((i) => i.id === integrationId) ?? null;
  }, [integrationId, integrations]);

  const [confirmOpen, setConfirmOpen] = useState(false);

  // Version history integration
  const uri: string | null = useMemo(() => {
    if (input && typeof input === "object") {
      const maybeUri =
        (input as { uri?: unknown; resource?: unknown }).uri ??
        (input as { resource?: unknown }).resource;
      return typeof maybeUri === "string" ? maybeUri : null;
    }
    return null;
  }, [input]);

  const { canRevert, revertLabel, onConfirmRevert } = useVersionRevertControls(
    toolName,
    part,
    uri,
  );

  const customIcon = createIntegrationIcon(integration, "build");

  const headerActions = (
    <>
      {canRevert && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmOpen(true);
                }}
              >
                <Icon name="undo" className="text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span>Revert to {revertLabel}</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  );

  // Custom UI for resource tools
  const customUI =
    isResourceTool && resourceUri ? (
      <ResourceToolCustomUI
        part={part}
        resourceUri={resourceUri}
        onOpenResource={handleResourceClick}
      />
    ) : undefined;

  return (
    <>
      <ToolCallDetail
        part={part}
        icon={customIcon}
        title={toolName}
        headerActions={headerActions}
        defaultShowCustomView={true}
      >
        {customUI}
      </ToolCallDetail>

      {/* Confirmation dialog */}
      {canRevert && (
        <AlertDialog open={confirmOpen}>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Revert Resource Version</AlertDialogTitle>
              <AlertDialogDescription>
                This will restore the resource to version {revertLabel}.
                Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmOpen(false);
                  onConfirmRevert();
                }}
              >
                Revert
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
});

function ImagePrompt({
  prompt,
  isCollapsible = true,
}: {
  prompt: string;
  isCollapsible?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isCollapsible || prompt.length <= 60) {
    return (
      <p className="text-sm text-muted-foreground/80 leading-relaxed wrap-break-word whitespace-pre-wrap">
        {prompt}
      </p>
    );
  }

  const truncatedPrompt = prompt.slice(0, 60) + "...";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-2 w-full">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-sm text-muted-foreground/80 hover:text-muted-foreground font-normal justify-start w-full text-left"
          >
            <span className="leading-relaxed wrap-break-word flex-1 min-w-0">
              {truncatedPrompt}
            </span>
            <Icon
              name="chevron_right"
              className={cn(
                "ml-2 h-3 w-3 shrink-0 transition-transform",
                isOpen && "rotate-90",
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="text-sm text-muted-foreground/80 leading-relaxed pl-4 border-l-2 border-muted wrap-break-word whitespace-pre-wrap">
            {prompt}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function GeneratingStatus() {
  return <span className="font-medium text-shimmer">Generating image...</span>;
}

// Helper to extract image from tool output
function extractImageFromOutput(output: unknown): string | null {
  if (
    output &&
    typeof output === "object" &&
    "structuredContent" in output &&
    output.structuredContent &&
    typeof output.structuredContent === "object" &&
    "image" in output.structuredContent &&
    typeof output.structuredContent.image === "string"
  ) {
    return output.structuredContent.image;
  }
  return null;
}

function GenerateImageToolUI({ part }: { part: ToolUIPart }) {
  const prompt =
    typeof part.input === "object" && part.input && "prompt" in part.input
      ? (part.input.prompt as string | null)
      : null;
  const image = extractImageFromOutput(part.output);
  const isGenerating = isToolLoading(part.state);
  const isGenerated = part.state === "output-available" && image;
  const hasError = part.state === "output-error";

  if (!prompt) {
    return (
      <ToolCallDetail part={part} icon="image" title="Generate Image">
        <p className="text-muted-foreground">Missing image prompt</p>
      </ToolCallDetail>
    );
  }

  let customUI: ReactNode;
  if (hasError) {
    customUI = (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-destructive">
          <Icon name="close" className="h-4 w-4" />
          <span className="font-medium">Failed to generate image</span>
        </div>
        <ImagePrompt prompt={prompt} />
      </div>
    );
  } else if (isGenerating) {
    customUI = (
      <div className="space-y-3">
        <GeneratingStatus />
        <ImagePrompt prompt={prompt} />
      </div>
    );
  } else if (isGenerated) {
    customUI = (
      <div className="space-y-3">
        <ImagePrompt prompt={prompt} />
        <div className="rounded-lg overflow-hidden border border-border">
          <img
            src={image}
            alt={prompt}
            className="w-full max-h-[400px] object-cover"
          />
        </div>
      </div>
    );
  } else {
    customUI = (
      <div className="space-y-3">
        <p className="text-muted-foreground">No image generated</p>
        <ImagePrompt prompt={prompt} />
      </div>
    );
  }

  return (
    <ToolCallDetail part={part} icon="image" title="Generate Image">
      {customUI}
    </ToolCallDetail>
  );
}

// Custom UI component for DECO_RESOURCE_MCP_STORE_SEARCH tool
function SearchMcpsToolUI({ part }: { part: ToolUIPart }) {
  const input = part.input as { query?: string } | undefined;
  const output = part.output as
    | {
        integrations?: Array<
          Integration & { friendlyName?: string; isInstalled?: boolean }
        >;
      }
    | undefined;
  const searchResults = output?.integrations || [];
  const installedCount = searchResults.filter((i) => i.isInstalled).length;
  const totalCount = searchResults.length;
  const hasOutput = hasToolOutput(part.state);

  const title = (
    <>
      Search MCPs
      {input?.query && (
        <span className="text-muted-foreground/70 ml-1">"{input.query}"</span>
      )}
    </>
  );

  const statusBadge =
    hasOutput && totalCount > 0
      ? `${totalCount} found (${installedCount} installed)`
      : undefined;

  const customUI =
    hasOutput && searchResults.length > 0 ? (
      <div className="flex flex-col relative">
        <div className="relative px-1.5 flex">
          <div className="w-5 flex items-center justify-center shrink-0">
            <div className="w-0.5 h-full bg-border" />
          </div>
          <div className="flex-1 pl-4 min-w-0">
            <div className="flex flex-col gap-3 py-2 pb-8">
              {searchResults.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center gap-4 w-full min-w-0 overflow-hidden"
                >
                  <div className="flex items-center gap-2 shrink-0">
                    <IntegrationIcon
                      icon={integration.icon}
                      name={integration.friendlyName ?? integration.name}
                      size="xs"
                      className="shrink-0"
                    />
                    <div className="text-xs font-normal text-foreground truncate">
                      {integration.friendlyName ?? integration.name}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 text-xs text-muted-foreground/75 truncate">
                    {integration.description || ""}
                  </div>
                  {integration.isInstalled && (
                    <div className="bg-primary text-primary-foreground text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0">
                      Installed
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <ToolCallDetail
      part={part}
      icon="search"
      title={title}
      statusBadge={statusBadge}
    >
      {customUI}
    </ToolCallDetail>
  );
}

// Custom UI component for DECO_RESOURCE_MCP_READ tool
function ReadMCPToolUI({ part }: { part: ToolUIPart }) {
  const input = part.input as { id?: string } | undefined;
  const integration = useIntegrationById(input?.id);

  const title = integration?.name || "Integration";
  const customIcon = createIntegrationIcon(integration);

  return (
    <ToolCallDetail
      part={part}
      icon={customIcon}
      title={title}
      defaultShowCustomView={false}
      showDebugToggle={false}
    />
  );
}

// Hook to extract tool name, URI, and integration ID from CALL_TOOL input
function useCallToolInfo(part: ToolUIPart) {
  const input = part.input as
    | {
        id?: string;
        params?: {
          name?: string;
          arguments?: Record<string, unknown>;
        };
      }
    | undefined;

  const toolName = input?.params?.name ?? null;
  const integrationId = input?.id ?? null;

  const uri = useMemo(() => {
    const args = input?.params?.arguments;
    if (args && typeof args === "object") {
      const maybeUri =
        (args as { uri?: unknown; resource?: unknown }).uri ??
        (args as { resource?: unknown }).resource;
      return typeof maybeUri === "string" ? maybeUri : null;
    }
    return null;
  }, [input?.params?.arguments]);

  return { toolName, integrationId, uri };
}

// Custom UI component for CALL_TOOL tool
function CallToolUI({ part }: { part: ToolUIPart }) {
  const { toolName: rawToolName, integrationId, uri } = useCallToolInfo(part);
  const toolName = rawToolName ?? undefined;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data: integrations = [] } = useIntegrations();

  const integration = useIntegrationById(integrationId);

  const { canRevert, revertLabel, onConfirmRevert } = useVersionRevertControls(
    toolName || "",
    part,
    uri,
  );

  // Copy input to clipboard functionality
  const { handleCopy, copied } = useCopy();
  const inputJsonString = useMemo(() => {
    if (!part.input) return "";
    return JSON.stringify(part.input, null, 2);
  }, [part.input]);

  // Canvas tabs management
  const { tabs, addTab, setActiveTab } = useThread();

  // Track if we've already opened the tab for this tool call
  const hasOpenedTabRef = useRef(false);

  // Check if resource URI exists in output (for resource operations)
  const resourceUri = useMemo(() => {
    // Extract URI using shared utility (handles both CALL_TOOL and direct resource tools)
    const toolInput = part.input as
      | {
          id?: string;
          params?: {
            name?: string;
            arguments?: Record<string, unknown>;
          };
        }
      | undefined;
    const toolOutput =
      part.state === "output-available"
        ? (() => {
            const output = part.output as
              | { structuredContent?: { uri?: string; data?: unknown } }
              | undefined;
            if (output?.structuredContent) {
              return {
                uri: output.structuredContent.uri,
                data: output.structuredContent.data,
              };
            }
            return output as { uri?: string; data?: unknown } | undefined;
          })()
        : undefined;

    return extractResourceUri("CALL_TOOL", toolInput, toolOutput);
  }, [part.input, part.state, part.output]);

  // Automatically open/activate tab when resource URI becomes available (once)
  useEffect(() => {
    if (
      resourceUri &&
      part.state === "output-available" &&
      !hasOpenedTabRef.current
    ) {
      hasOpenedTabRef.current = true;
      openResourceTab(resourceUri, tabs, integrations, addTab, setActiveTab);
    }
  }, [resourceUri, part.state, tabs, integrations, addTab, setActiveTab]);

  // Handle opening resource in tab
  const handleResourceClick = useCallback(() => {
    if (resourceUri) {
      // Open in tab if resource URI exists (using shared utility)
      openResourceTab(resourceUri, tabs, integrations, addTab, setActiveTab);
    }
  }, [resourceUri, tabs, integrations, addTab, setActiveTab]);

  const copyButton = part.input ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(inputJsonString);
            }}
          >
            <Icon
              name={copied ? "check" : "content_copy"}
              className="text-muted-foreground"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span>{copied ? "Copied!" : "Copy input"}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;

  const headerActions = (
    <>
      {resourceUri && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResourceClick();
                }}
              >
                <Icon name="open_in_full" className="text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span>Open resource</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {canRevert && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmOpen(true);
                }}
              >
                <Icon name="undo" className="text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span>Revert to {revertLabel}</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {copyButton}
    </>
  );

  const customIcon = createIntegrationIcon(integration, "build");

  return (
    <>
      <ToolCallDetail
        part={part}
        icon={customIcon}
        title={toolName}
        headerActions={headerActions}
        defaultShowCustomView={false}
        showDebugToggle={false}
      />

      {/* Confirmation dialog for revert */}
      {canRevert && (
        <AlertDialog open={confirmOpen}>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Revert Resource Version</AlertDialogTitle>
              <AlertDialogDescription>
                This will restore the resource to version {revertLabel}.
                Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmOpen(false);
                  onConfirmRevert();
                }}
              >
                Revert
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

// Render Preview Tool UI
function RenderPreviewToolUI({ part }: { part: ToolUIPart }) {
  const result = (part.output ?? {}) as Record<string, unknown>;
  const hasOutput = part.state === "output-available" && part.output;

  const customUI = hasOutput ? (
    <Preview
      content={result.content as "url" | "html"}
      title={result.title as string}
    />
  ) : null;

  return (
    <ToolCallDetail part={part} icon="preview" title="Preview">
      {customUI}
    </ToolCallDetail>
  );
}

// Hosting App Deploy Tool UI
function HostingAppDeployToolUI({ part }: { part: ToolUIPart }) {
  const toolName = useToolName(part);
  const toolLike: HostingAppToolLike = {
    toolCallId: part.toolCallId,
    toolName: toolName,
    state: mapToToolLikeState(part.state),
    args: part.input as HostingAppToolLike["args"],
    result: part.output,
  };

  return (
    <ToolCallDetail part={part} icon="rocket_launch" title="Deploy App">
      <HostingAppDeploy tool={toolLike} />
    </ToolCallDetail>
  );
}

function SecretsPromptUI({ part }: { part: ToolUIPart }) {
  const [value, setValue] = useState("");
  const [isAdded, setIsAdded] = useState(false);
  const createSecret = useCreateSecret();
  const { data: secrets = [] } = useSecrets();

  // Extract from structuredContent (when called via CALL_TOOL)
  const outputData =
    (part.output as Record<string, unknown>)?.structuredContent ??
    part.output ??
    {};
  const result = outputData as {
    name?: string;
    description?: string;
    action?: string;
  };

  const secretName = result.name || "";
  const description = result.description || "";

  // Check if secret already exists
  const existingSecret = useMemo(
    () => secrets.find((s) => s.name === secretName),
    [secrets, secretName],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretName || !value) return;

    try {
      await createSecret.mutateAsync({
        name: secretName,
        value,
        description: description || undefined,
      });
      toast.success(`Secret "${secretName}" created successfully`);
      setIsAdded(true);
      setValue("");
    } catch (error) {
      toast.error(
        `Failed to create secret: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  // If secret was just added
  if (isAdded) {
    return (
      <div className="p-4 border rounded-lg bg-green-500/5 border-green-500/20">
        <div className="flex items-center gap-2 text-sm">
          <Icon name="check_circle" className="size-5 text-green-500" />
          <div>
            <div className="font-medium text-green-700 dark:text-green-400">
              Secret Added
            </div>
            <div className="text-xs text-muted-foreground">
              {secretName} is now available for use
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If secret already exists
  if (existingSecret) {
    return (
      <div className="p-4 border rounded-lg bg-blue-500/5 border-blue-500/20">
        <div className="flex items-center gap-2 text-sm">
          <Icon name="info" className="size-5 text-blue-500" />
          <div>
            <div className="font-medium text-blue-700 dark:text-blue-400">
              Secret Already Exists
            </div>
            <div className="text-xs text-muted-foreground">
              {secretName} is already configured in your project
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Prompt to add secret
  return (
    <div className="p-4 border border-border rounded-lg bg-background space-y-3">
      <div className="flex items-start gap-3">
        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon name="key" className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm mb-1">
            Secret Required: {secretName}
          </div>
          {description && (
            <div className="text-xs text-muted-foreground mb-3">
              {description}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="secret-value" className="text-xs">
                Secret Value
              </Label>
              <Input
                id="secret-value"
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter secret value..."
                className="h-9"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={createSecret.isPending || !value}
              size="sm"
              className="w-full"
            >
              {createSecret.isPending ? "Adding..." : "Add Secret"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

// Secrets Prompt User Tool UI
function SecretsPromptUserToolUI({ part }: { part: ToolUIPart }) {
  return (
    <ToolCallDetail part={part} icon="key" title="Add Secret">
      <ErrorBoundary
        fallback={
          <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5 text-sm text-destructive">
            Failed to load secrets prompt
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="p-4 border border-border rounded-lg bg-background">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon
                  name="progress_activity"
                  className="size-4 animate-spin"
                />
                Loading...
              </div>
            </div>
          }
        >
          <SecretsPromptUI part={part} />
        </Suspense>
      </ErrorBoundary>
    </ToolCallDetail>
  );
}

function CustomToolUI({ part }: { part: ToolUIPart }) {
  const toolName = useToolName(part);

  // Handle tools that need custom UI for all states (including loading)
  if (toolName === "HOSTING_APP_DEPLOY") {
    return <HostingAppDeployToolUI part={part} />;
  }

  if (toolName === "GENERATE_IMAGE") {
    return <GenerateImageToolUI part={part} />;
  }

  if (toolName === "DECO_RESOURCE_MCP_READ") {
    return <ReadMCPToolUI part={part} />;
  }

  if (toolName === "DECO_RESOURCE_MCP_STORE_SEARCH") {
    return <SearchMcpsToolUI part={part} />;
  }

  if (toolName === "CALL_TOOL") {
    return <CallToolUI part={part} />;
  }

  if (toolName === "RENDER") {
    return <RenderPreviewToolUI part={part} />;
  }

  if (toolName === "SECRETS_PROMPT_USER") {
    return <SecretsPromptUserToolUI part={part} />;
  }

  return null;
}

export const ToolMessage = memo(function ToolMessage({
  part,
}: ToolMessageProps) {
  const isCustomUI = useIsCustomUITool(part);

  return (
    <div className="w-full space-y-4">
      {isCustomUI ? <CustomToolUI part={part} /> : <ToolStatus part={part} />}
    </div>
  );
});

// Local hook to encapsulate revert availability and handler
function useVersionRevertControls(
  toolName: string,
  part: ToolUIPart,
  uri: string | null,
) {
  const revertToVersion = useRevertToVersion();
  const versions = useGetVersions(uri || "");
  const versionForPart = useMemo(() => {
    if (!uri) return null;
    return (
      versions.find((v) => v.toolCall?.toolCallId === part.toolCallId) || null
    );
  }, [versions, uri, part.toolCallId]);

  const canRevert = Boolean(
    uri &&
      part.state === "output-available" &&
      (/^DECO_RESOURCE_.*_UPDATE$/.test(toolName) ||
        /^DECO_RESOURCE_.*_READ$/.test(toolName)) &&
      versionForPart,
  );

  const revertLabel = useMemo(
    () => (versionForPart ? truncateHash(versionForPart.hash) : ""),
    [versionForPart, truncateHash],
  );

  const onConfirmRevert = useCallback(() => {
    if (versionForPart) {
      revertToVersion(versionForPart.hash);
    }
  }, [revertToVersion, versionForPart]);

  return { canRevert, revertLabel, onConfirmRevert } as const;
}
