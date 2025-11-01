import { useIntegrations, DECO_CMS_API_URL, useViewByUriV2 } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
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
import { cn } from "@deco/ui/lib/utils.ts";
import { ToolUIPart } from "ai";
import { memo, useMemo, useRef, useState, useCallback, useEffect } from "react";
import { IntegrationIcon } from "../integrations/common.tsx";
import { useThreadContext } from "../decopilot/thread-context-provider.tsx";
import type { ToolsetContextItem } from "./types.ts";
import {
  extractToolName,
  parseToolName,
  getStatusStyles,
} from "../../utils/tool-namespace.ts";
import { JsonViewer } from "./json-viewer.tsx";
import {
  HostingAppDeploy,
  HostingAppToolLike,
} from "./tools/hosting-app-deploy.tsx";
import { Preview } from "./tools/render-preview.tsx";
import {
  truncateHash,
  useGetVersions,
  useRevertToVersion,
} from "../../stores/resource-version-history/index.ts";
import { generateViewHTML } from "../../utils/view-template.ts";
import { useParams, useNavigate } from "react-router";
import { useTheme } from "../theme.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import ViewDetail from "../views/view-detail.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";

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
  "READ_MCP",
  "CALL_TOOL",
  "DECO_RESOURCE_VIEW_CREATE",
  "DECO_RESOURCE_VIEW_UPDATE",
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

const ToolStatus = memo(function ToolStatus({
  part,
  isSingle,
}: {
  part: ToolUIPart;
  isSingle: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { state, input, output, errorText } = part;

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

  // Parse integration ID from namespaced tool name
  const integrationId = useMemo(() => {
    if (!rawToolName) return null;
    const parsed = parseToolName(rawToolName);
    return parsed?.integrationId ?? null;
  }, [rawToolName]);

  // Find matching integration
  const integration = useMemo(() => {
    if (!integrationId) return null;
    return integrations.find((i) => i.id === integrationId) ?? null;
  }, [integrationId, integrations]);

  const isLoading = state === "input-streaming" || state === "input-available";
  const hasOutput = state === "output-available";
  const hasError = state === "output-error";

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

  const statusText = useMemo(() => {
    switch (state) {
      case "input-streaming":
        return "Generating input...";
      case "input-available":
        return "Running the tool...";
      case "output-available":
        return "Done";
      case "output-error":
        return "Error";
      default:
        return "Unknown";
    }
  }, [state]);

  const statusConfig = useMemo(() => getStatusStyles(state), [state]);

  const onClick = useCallback(() => {
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
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col relative",
        isSingle && "p-2.5 hover:bg-accent/25 rounded-2xl",
      )}
      onClick={undefined}
    >
      <div className="flex items-start gap-2">
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          className={cn(
            "w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
            !isSingle && "hover:bg-accent rounded-lg p-2",
          )}
        >
          {integration ? (
            <IntegrationIcon
              icon={integration.icon}
              name={integration.name}
              size="sm"
              className="shrink-0"
            />
          ) : (
            <div className="size-5 rounded-full bg-muted/30 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div
                  className={cn(
                    "font-medium truncate",
                    isLoading &&
                      "bg-linear-to-r from-foreground via-foreground/50 to-foreground bg-size-[200%_100%] animate-shimmer bg-clip-text text-transparent",
                  )}
                >
                  {toolName}
                </div>
                <div
                  className={cn(
                    "text-xs opacity-70 shrink-0",
                    statusConfig.className,
                  )}
                >
                  {statusText}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1">
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
                <Icon
                  className={cn("text-sm", isExpanded && "rotate-90")}
                  name="chevron_right"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div
          ref={contentRef}
          className="text-left mt-2 space-y-3 w-full min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Input Section */}
          {input !== undefined && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
                <Icon name="arrow_downward" className="size-3" />
                Input
              </div>
              <JsonViewer data={input} defaultView="tree" maxHeight="300px" />
            </div>
          )}

          {/* Output Section */}
          {hasOutput && output !== undefined && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
                <Icon name="arrow_upward" className="size-3" />
                Output
              </div>
              <JsonViewer data={output} defaultView="tree" maxHeight="300px" />
            </div>
          )}

          {/* Error Section */}
          {hasError && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-destructive px-1 flex items-center gap-2">
                <Icon name="error_outline" className="size-3" />
                Error
              </div>
              {errorText && (
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
                  {errorText}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
    </div>
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
  return (
    <span className="font-medium bg-linear-to-r from-foreground via-foreground/50 to-foreground bg-size-[200%_100%] animate-shimmer bg-clip-text text-transparent">
      Generating image...
    </span>
  );
}

function GenerateImageToolUI({ part }: { part: ToolUIPart }) {
  const state = part.state;
  const prompt =
    typeof part.input === "object" && part.input && "prompt" in part.input
      ? part.input.prompt
      : null;

  if (!prompt || typeof prompt !== "string") {
    return (
      <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/10 w-full max-w-full overflow-hidden">
        <p className="text-muted-foreground">Missing image prompt</p>
      </div>
    );
  }

  // Extract image URL from output.structuredContent.image
  const image =
    part.output &&
    typeof part.output === "object" &&
    "structuredContent" in part.output &&
    part.output.structuredContent &&
    typeof part.output.structuredContent === "object" &&
    "image" in part.output.structuredContent &&
    typeof part.output.structuredContent.image === "string"
      ? part.output.structuredContent.image
      : null;

  const isGenerating =
    state === "input-streaming" || state === "input-available";
  const isGenerated = state === "output-available" && image;
  const hasError = state === "output-error";

  if (hasError) {
    return (
      <div className="space-y-3 p-4 border border-destructive/20 rounded-lg bg-destructive/5 w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-2 text-destructive">
          <Icon name="close" className="h-4 w-4" />
          <span className="font-medium">Failed to generate image</span>
        </div>
        <ImagePrompt prompt={prompt} />
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/20 w-full max-w-full overflow-hidden">
        <GeneratingStatus />
        <ImagePrompt prompt={prompt} />
      </div>
    );
  }

  if (isGenerated) {
    return (
      <div className="space-y-3 w-full max-w-full overflow-hidden">
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
  }

  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/10 w-full max-w-full overflow-hidden">
      <p className="text-muted-foreground">No image generated</p>
      <ImagePrompt prompt={prompt} />
    </div>
  );
}

// Shared expandable tool card component
interface ExpandableToolCardProps {
  part: ToolUIPart;
  integration: { icon?: string; name?: string } | null;
  toolName?: string;
  toolDescription?: string;
  statusText?: string;
  children: React.ReactNode;
  canRevert?: boolean;
  revertLabel?: string;
  onConfirmRevert?: () => void;
}

function ExpandableToolCard({
  part,
  integration,
  toolName,
  toolDescription: _toolDescription,
  statusText: customStatusText,
  children,
  canRevert,
  revertLabel,
  onConfirmRevert,
}: ExpandableToolCardProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const statusText = useMemo(() => {
    if (customStatusText) return customStatusText;

    switch (part.state) {
      case "input-streaming":
        return "Reading...";
      case "input-available":
        return "Reading...";
      case "output-available":
        return "Read";
      case "output-error":
        return "Error";
      default:
        return "Unknown";
    }
  }, [part.state, customStatusText]);

  const statusConfig = useMemo(() => getStatusStyles(part.state), [part.state]);

  // Check if we should show expanded view (input states or manually expanded)
  const shouldExpand = useMemo(() => {
    return (
      part.state === "input-streaming" ||
      part.state === "input-available" ||
      isManuallyExpanded
    );
  }, [part.state, isManuallyExpanded]);

  const handleToggleExpand = useCallback(() => {
    setIsManuallyExpanded((prev) => !prev);
  }, []);

  return (
    <>
      <div className="flex flex-col border border-border rounded-xl bg-muted/20 overflow-hidden">
        <button
          type="button"
          onClick={handleToggleExpand}
          className={cn(
            "flex items-center justify-between p-2 transition-colors cursor-pointer",
            "hover:bg-muted",
          )}
        >
          <div className="flex items-center gap-2">
            {integration ? (
              <IntegrationIcon
                icon={integration.icon}
                name={integration.name}
                size="sm"
                className="size-5 shrink-0"
              />
            ) : (
              <div className="size-5 rounded-full bg-muted/30 shrink-0" />
            )}
            <span className="text-sm font-medium text-foreground">
              {toolName || integration?.name || "Integration"}
            </span>
            <div className={cn("text-xs", statusConfig.className)}>
              {statusText}
            </div>
          </div>
          <div className="flex items-center gap-1">
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
            <Icon
              name="expand_less"
              className={cn(
                "transition-transform duration-200",
                shouldExpand ? "rotate-180" : "rotate-90",
              )}
            />
          </div>
        </button>

        {shouldExpand && (
          <div
            ref={contentRef}
            className="text-left space-y-3 w-full min-w-0 px-2 py-2 border-t"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        )}
      </div>

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
                  onConfirmRevert?.();
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

// Custom UI component for READ_MCP tool
function ReadMCPToolUI({ part }: { part: ToolUIPart }) {
  const { data: integrations = [] } = useIntegrations();
  const input = part.input as { id?: string } | undefined;
  const integrationId = input?.id;

  const integration = useMemo(() => {
    if (!integrationId) return null;
    return integrations.find((i) => i.id === integrationId) ?? null;
  }, [integrationId, integrations]);

  // Sync to context when tool executes
  const { addContextItem, contextItems } = useThreadContext();
  const hasAddedRef = useRef(false);
  useEffect(() => {
    if (
      part.state === "output-available" &&
      integrationId &&
      integration &&
      !hasAddedRef.current
    ) {
      // Check if this integration is already in context
      const exists = contextItems.some(
        (item) =>
          item.type === "toolset" && item.integrationId === integrationId,
      );
      if (!exists) {
        addContextItem({
          type: "toolset",
          integrationId,
          enabledTools: integration.tools?.map((t) => t.name) || [],
        } as Omit<ToolsetContextItem, "id">);
        hasAddedRef.current = true;
      }
    }
  }, [part.state, integrationId, integration, addContextItem, contextItems]);

  return (
    <ExpandableToolCard
      part={part}
      integration={integration}
      toolName={integration?.name}
      toolDescription={integration?.description || undefined}
    >
      {/* Input Section */}
      {part.input !== undefined && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
            <Icon name="arrow_downward" className="size-3" />
            Input
          </div>
          <JsonViewer data={part.input} defaultView="tree" maxHeight="300px" />
        </div>
      )}

      {/* Output Section */}
      {part.state === "output-available" && part.output !== undefined && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
            <Icon name="arrow_upward" className="size-3" />
            Output
          </div>
          <JsonViewer data={part.output} defaultView="tree" maxHeight="300px" />
        </div>
      )}

      {/* Error Section */}
      {part.state === "output-error" && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-destructive px-1 flex items-center gap-2">
            <Icon name="error_outline" className="size-3" />
            Error
          </div>
          {part.errorText && (
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
              {part.errorText}
            </div>
          )}
        </div>
      )}
    </ExpandableToolCard>
  );
}

// Custom UI component for CALL_TOOL tool
function CallToolUI({ part }: { part: ToolUIPart }) {
  const { data: integrations = [] } = useIntegrations();
  const input = part.input as
    | {
        id?: string;
        params?: {
          name?: string;
          arguments?: Record<string, unknown>;
        };
      }
    | undefined;
  const integrationId = input?.id;
  const toolName = input?.params?.name;

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const integration = useMemo(() => {
    if (!integrationId) return null;
    return integrations.find((i) => i.id === integrationId) ?? null;
  }, [integrationId, integrations]);

  const toolDescription = useMemo(() => {
    if (!integration?.tools || !toolName) return null;
    const tool = integration.tools.find((t) => t.name === toolName);
    return tool?.description || null;
  }, [integration?.tools, toolName]);

  // Sync to context when tool executes
  const { addContextItem, updateContextItem, contextItems } =
    useThreadContext();
  const hasAddedRef = useRef(false);
  useEffect(() => {
    if (
      part.state === "output-available" &&
      integrationId &&
      toolName &&
      integration &&
      !hasAddedRef.current
    ) {
      // Find existing toolset item for this integration
      const existingItem = contextItems.find(
        (item) =>
          item.type === "toolset" && item.integrationId === integrationId,
      );

      if (existingItem && existingItem.type === "toolset") {
        // Update existing item to include this tool if not already present
        if (!existingItem.enabledTools.includes(toolName)) {
          updateContextItem(existingItem.id, {
            enabledTools: [...existingItem.enabledTools, toolName],
          });
          hasAddedRef.current = true;
        }
      } else {
        // Create new toolset item
        addContextItem({
          type: "toolset",
          integrationId,
          enabledTools: [toolName],
        } as Omit<ToolsetContextItem, "id">);
        hasAddedRef.current = true;
      }
    }
  }, [
    part.state,
    integrationId,
    toolName,
    integration,
    addContextItem,
    updateContextItem,
    contextItems,
  ]);

  const statusText = useMemo(() => {
    switch (part.state) {
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
  }, [part.state]);

  // Version history integration
  const uri: string | null = useMemo(() => {
    const args = input?.params?.arguments;
    if (args && typeof args === "object") {
      const maybeUri =
        (args as { uri?: unknown; resource?: unknown }).uri ??
        (args as { resource?: unknown }).resource;
      return typeof maybeUri === "string" ? maybeUri : null;
    }
    return null;
  }, [input?.params?.arguments]);

  const { canRevert, revertLabel, onConfirmRevert } = useVersionRevertControls(
    toolName || "",
    part,
    uri,
  );

  // Check if this is a view tool being called via CALL_TOOL
  // NOW we can do conditional returns after all hooks are called
  const isViewTool =
    toolName === "DECO_RESOURCE_VIEW_CREATE" ||
    toolName === "DECO_RESOURCE_VIEW_UPDATE";

  // If it's a view tool, render with ViewToolUI style
  if (isViewTool) {
    const isGenerating =
      part.state === "input-streaming" || part.state === "input-available";
    const hasError = part.state === "output-error";

    if (hasError) {
      return (
        <div className="space-y-3 p-4 border border-destructive/20 rounded-lg bg-destructive/5 w-full max-w-full overflow-hidden">
          <div className="flex items-center gap-2 text-destructive">
            <Icon name="close" className="h-4 w-4" />
            <span className="font-medium">
              Failed to{" "}
              {toolName === "DECO_RESOURCE_VIEW_CREATE" ? "create" : "update"}{" "}
              view
            </span>
          </div>
          {part.errorText && (
            <p className="text-sm text-destructive/80">{part.errorText}</p>
          )}
        </div>
      );
    }

    if (isGenerating) {
      return (
        <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/20 w-full max-w-full overflow-hidden">
          <div className="flex items-center gap-2">
            <Spinner />
            <span className="font-medium bg-linear-to-r from-foreground via-foreground/50 to-foreground bg-size-[200%_100%] animate-shimmer bg-clip-text text-transparent">
              {toolName === "DECO_RESOURCE_VIEW_CREATE"
                ? "Creating"
                : "Updating"}{" "}
              view...
            </span>
          </div>
        </div>
      );
    }

    if (part.state === "output-available") {
      return <ViewToolUIFromCallTool part={part} toolName={toolName} />;
    }
  }

  return (
    <ExpandableToolCard
      part={part}
      integration={integration}
      toolName={toolName}
      toolDescription={toolDescription || undefined}
      statusText={statusText}
      canRevert={canRevert}
      revertLabel={revertLabel}
      onConfirmRevert={onConfirmRevert}
    >
      {/* Input Section */}
      {part.input !== undefined && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
            <Icon name="arrow_downward" className="size-3" />
            Input
          </div>
          <JsonViewer data={part.input} defaultView="tree" maxHeight="300px" />
        </div>
      )}

      {/* Output Section */}
      {part.state === "output-available" && part.output !== undefined && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
            <Icon name="arrow_upward" className="size-3" />
            Output
          </div>
          <JsonViewer data={part.output} defaultView="tree" maxHeight="300px" />
        </div>
      )}

      {/* Error Section */}
      {part.state === "output-error" && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-destructive px-1 flex items-center gap-2">
            <Icon name="error_outline" className="size-3" />
            Error
          </div>
          {part.errorText && (
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
              {part.errorText}
            </div>
          )}
        </div>
      )}
    </ExpandableToolCard>
  );
}

// Custom UI component for view tools called via CALL_TOOL
function ViewToolUIFromCallTool({
  part,
  toolName,
}: {
  part: ToolUIPart;
  toolName: string;
}) {
  const navigateWorkspace = useNavigateWorkspace();
  const { org, project } = useParams<{ org: string; project: string }>();
  const themeContext = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Extract view URI from CALL_TOOL output
  const viewUri = useMemo(() => {
    if (part.state !== "output-available" || !part.output) return null;
    const output = part.output as {
      isError?: boolean;
      structuredContent?:
        | { uri?: string }
        | Array<{ type?: string; text?: string }>;
      content?: Array<{ type?: string; text?: string }>;
    };

    console.log("[ViewToolUI] Extracting URI from output:", part.output);

    // Check if structuredContent has uri directly
    if (
      output.structuredContent &&
      typeof output.structuredContent === "object" &&
      !Array.isArray(output.structuredContent)
    ) {
      if ("uri" in output.structuredContent && output.structuredContent.uri) {
        console.log(
          "[ViewToolUI] Found URI in structuredContent:",
          output.structuredContent.uri,
        );
        return output.structuredContent.uri;
      }
    }

    // Fallback: Check content array (old format)
    if (output.content && Array.isArray(output.content)) {
      for (const item of output.content) {
        if (item.type === "text" && item.text) {
          try {
            const parsed = JSON.parse(item.text);
            console.log("[ViewToolUI] Parsed content:", parsed);
            if (parsed.uri) {
              console.log("[ViewToolUI] Found URI:", parsed.uri);
              return parsed.uri;
            }
          } catch (e) {
            console.log("[ViewToolUI] Not JSON:", item.text);
            // Not JSON, continue
          }
        }
      }
    }

    console.log("[ViewToolUI] No URI found in output");
    return null;
  }, [part.state, part.output]);

  // Fetch view data
  const { data: viewResponse, isLoading } = useViewByUriV2(viewUri || "");
  const view = viewResponse?.data;

  // Generate HTML for preview
  const htmlValue = useMemo(() => {
    if (!view?.code || !org || !project) return null;

    try {
      return generateViewHTML(
        view.code,
        DECO_CMS_API_URL,
        org,
        project,
        window.location.origin,
        view.importmap,
        themeContext?.data?.variables as Record<string, string> | undefined,
      );
    } catch (error) {
      console.error("Failed to generate view HTML:", error);
      return null;
    }
  }, [
    view?.code,
    view?.importmap,
    org,
    project,
    themeContext?.data?.variables,
  ]);

  const handleNavigateToView = useCallback(() => {
    if (!viewUri) return;

    // Extract integration ID and resource name from URI
    // Format: rsc://integrationId/resourceName/resourceId
    try {
      const uriWithoutScheme = viewUri.replace(/^rsc:\/\//, "");
      const [integrationId, resourceName] = uriWithoutScheme.split("/");

      if (integrationId && resourceName) {
        navigateWorkspace(
          `rsc/${integrationId}/${resourceName}/${encodeURIComponent(viewUri)}`,
        );
      } else {
        console.error("[ViewToolUI] Invalid URI format:", viewUri);
      }
    } catch (error) {
      console.error("[ViewToolUI] Error parsing URI:", error);
    }
  }, [viewUri, navigateWorkspace]);

  // Don't return null - always show something
  if (!viewUri) {
    return (
      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <div className="p-4 bg-muted/10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon name="visibility" className="h-4 w-4" />
            <span className="text-sm">
              View{" "}
              {toolName === "DECO_RESOURCE_VIEW_CREATE" ? "created" : "updated"}{" "}
              (check console for details)
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border border-border rounded-lg overflow-hidden bg-background",
        isFullscreen && "fixed inset-0 z-50 rounded-none",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/10">
        <div className="flex items-center gap-2">
          <Icon name="visibility" className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {view?.name || "View Preview"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isFullscreen ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsFullscreen(false)}
              className="shrink-0"
            >
              <Icon name="fullscreen_exit" className="h-3.5 w-3.5 mr-1.5" />
              Exit Fullscreen
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsFullscreen(true)}
              className="shrink-0"
            >
              <Icon name="fullscreen" className="h-3.5 w-3.5 mr-1.5" />
              Fullscreen
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleNavigateToView}
            className="shrink-0"
          >
            <Icon name="open_in_new" className="h-3.5 w-3.5 mr-1.5" />
            Open View
          </Button>
        </div>
      </div>

      {/* View iframe */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <Spinner />
        </div>
      )}

      {!isLoading && htmlValue && (
        <iframe
          srcDoc={htmlValue}
          className={cn(
            "w-full border-0",
            isFullscreen ? "h-[calc(100vh-57px)]" : "h-[400px]",
          )}
          title="View Preview"
          sandbox="allow-scripts allow-same-origin"
        />
      )}

      {!isLoading && !htmlValue && (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <span className="text-sm">Unable to render view preview</span>
        </div>
      )}
    </div>
  );
}

// Custom UI component for view creation/update tools
function ViewToolUI({ part }: { part: ToolUIPart }) {
  const navigateWorkspace = useNavigateWorkspace();
  const themeContext = useTheme();
  const toolName = useToolName(part);
  const { org, project } = useParams<{ org: string; project: string }>();

  // Extract view URI from output
  const viewUri = useMemo(() => {
    if (part.state !== "output-available" || !part.output) return null;
    const output = part.output as { uri?: string };
    return output.uri || null;
  }, [part.state, part.output]);

  // Fetch view data
  const { data: viewResponse, isLoading } = useViewByUriV2(viewUri || "");

  // Extract view from response
  const view = viewResponse?.data;

  // Generate HTML for preview
  const htmlValue = useMemo(() => {
    if (!view?.code || !org || !project) return null;

    try {
      return generateViewHTML(
        view.code,
        DECO_CMS_API_URL,
        org,
        project,
        window.location.origin,
        view.importmap,
        themeContext?.data?.variables as Record<string, string> | undefined,
      );
    } catch (error) {
      console.error("Failed to generate view HTML:", error);
      return null;
    }
  }, [
    view?.code,
    view?.importmap,
    org,
    project,
    themeContext?.data?.variables,
  ]);

  const handleNavigateToView = useCallback(() => {
    if (!viewUri) return;

    // Extract integration ID and resource name from URI
    // Format: rsc://integrationId/resourceName/resourceId
    try {
      const uriWithoutScheme = viewUri.replace(/^rsc:\/\//, "");
      const [integrationId, resourceName] = uriWithoutScheme.split("/");

      if (integrationId && resourceName) {
        navigateWorkspace(
          `rsc/${integrationId}/${resourceName}/${encodeURIComponent(viewUri)}`,
        );
      } else {
        console.error("[ViewToolUI] Invalid URI format:", viewUri);
      }
    } catch (error) {
      console.error("[ViewToolUI] Error parsing URI:", error);
    }
  }, [viewUri, navigateWorkspace]);

  const isGenerating =
    part.state === "input-streaming" || part.state === "input-available";
  const hasError = part.state === "output-error";

  if (hasError) {
    return (
      <div className="space-y-3 p-4 border border-destructive/20 rounded-lg bg-destructive/5 w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-2 text-destructive">
          <Icon name="close" className="h-4 w-4" />
          <span className="font-medium">
            Failed to{" "}
            {toolName === "DECO_RESOURCE_VIEW_CREATE" ? "create" : "update"}{" "}
            view
          </span>
        </div>
        {part.errorText && (
          <p className="text-sm text-destructive/80">{part.errorText}</p>
        )}
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/20 w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-2">
          <Spinner />
          <span className="font-medium bg-linear-to-r from-foreground via-foreground/50 to-foreground bg-size-[200%_100%] animate-shimmer bg-clip-text text-transparent">
            {toolName === "DECO_RESOURCE_VIEW_CREATE" ? "Creating" : "Updating"}{" "}
            view...
          </span>
        </div>
      </div>
    );
  }

  if (!viewUri || !view) {
    return null;
  }

  return (
    <div className="space-y-3 w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="visibility" className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{view.name}</span>
          {view.description && (
            <span className="text-sm text-muted-foreground">
              — {view.description}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleNavigateToView}
          className="shrink-0"
        >
          <Icon name="open_in_new" className="h-3.5 w-3.5 mr-1.5" />
          Open View
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-8 border border-border rounded-lg bg-muted/10">
          <Spinner />
        </div>
      )}

      {htmlValue && (
        <div className="rounded-lg overflow-hidden border border-border bg-background">
          <iframe
            srcDoc={htmlValue}
            className="w-full h-[400px] border-0"
            title="View Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      )}
    </div>
  );
}

function CustomToolUI({ part }: { part: ToolUIPart }) {
  const result = (part.output ?? {}) as Record<string, unknown>;
  const toolName = useToolName(part);

  // Handle tools that need custom UI for all states (including loading)
  if (toolName === "HOSTING_APP_DEPLOY") {
    const toolLike: HostingAppToolLike = {
      toolCallId: part.toolCallId,
      toolName: toolName,
      state: mapToToolLikeState(part.state),
      args: part.input as HostingAppToolLike["args"],
    };
    return <HostingAppDeploy tool={toolLike} />;
  }

  if (toolName === "GENERATE_IMAGE") {
    return <GenerateImageToolUI part={part} />;
  }

  if (toolName === "READ_MCP") {
    return <ReadMCPToolUI part={part} />;
  }

  if (toolName === "CALL_TOOL") {
    return <CallToolUI part={part} />;
  }

  if (
    toolName === "DECO_RESOURCE_VIEW_CREATE" ||
    toolName === "DECO_RESOURCE_VIEW_UPDATE"
  ) {
    return <ViewToolUI part={part} />;
  }

  // For other tools, only show output when available
  if (part.state !== "output-available" || !part.output) return null;

  switch (toolName) {
    case "RENDER": {
      return (
        <Preview
          content={result.content as "url" | "html"}
          title={result.title as string}
        />
      );
    }
    default: {
      return null;
    }
  }
}

export const ToolMessage = memo(function ToolMessage({
  part,
}: ToolMessageProps) {
  const isCustomUI = useIsCustomUITool(part);

  return (
    <div className="w-full space-y-4">
      {isCustomUI ? (
        <CustomToolUI part={part} />
      ) : (
        <div className="flex flex-col gap-2 w-full border border-border rounded-2xl">
          <ToolStatus part={part} isSingle={true} />
        </div>
      )}
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
