import { useIntegrations, useSDK } from "@deco/sdk";
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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCopy } from "../../hooks/use-copy.ts";
import { usePinnedTabs } from "../../hooks/use-pinned-tabs.ts";
import {
  truncateHash,
  useGetVersions,
  useRevertToVersion,
} from "../../stores/resource-version-history/index.ts";
import { useThread } from "../decopilot/thread-provider.tsx";
import {
  extractToolName,
  getStatusStyles,
  parseToolName,
  resolveFullIntegrationId,
} from "../../utils/tool-namespace.ts";
import {
  extractResourceUri,
  openResourceTab,
} from "../../utils/resource-tabs.ts";
import { IntegrationIcon } from "../integrations/common.tsx";
import { JsonViewer } from "./json-viewer.tsx";
import {
  HostingAppDeploy,
  HostingAppToolLike,
} from "./tools/hosting-app-deploy.tsx";
import { Preview } from "./tools/render-preview.tsx";

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
                    isLoading && "text-shimmer",
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
      <p className="text-sm text-muted-foreground/80 leading-relaxed break-words whitespace-pre-wrap">
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
            <span className="leading-relaxed break-words flex-1 min-w-0">
              {truncatedPrompt}
            </span>
            <Icon
              name="chevron_right"
              className={cn(
                "ml-2 h-3 w-3 flex-shrink-0 transition-transform",
                isOpen && "rotate-90",
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="text-sm text-muted-foreground/80 leading-relaxed pl-4 border-l-2 border-muted break-words whitespace-pre-wrap">
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

// Custom UI component for READ_MCP tool
function ReadMCPToolUI({ part }: { part: ToolUIPart }) {
  const { data: integrations = [] } = useIntegrations();
  const input = part.input as { id?: string } | undefined;
  const integrationId = input?.id;
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const integration = useMemo(() => {
    if (!integrationId) return null;
    return integrations.find((i) => i.id === integrationId) ?? null;
  }, [integrationId, integrations]);

  const statusText = useMemo(() => {
    switch (part.state) {
      case "input-streaming":
        return "Generating input...";
      case "input-available":
        return "Reading...";
      case "output-available":
        return "Done";
      case "output-error":
        return "Error";
      default:
        return "Unknown";
    }
  }, [part.state]);

  const statusConfig = useMemo(() => getStatusStyles(part.state), [part.state]);
  const isLoading =
    part.state === "input-streaming" || part.state === "input-available";
  const hasOutput = part.state === "output-available";
  const hasError = part.state === "output-error";

  const handleClick = useCallback(() => {
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
    <div className="flex flex-col relative p-2.5 hover:bg-accent/25 rounded-2xl max-w-4xl">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-2 text-sm text-muted-foreground transition-colors cursor-pointer hover:text-foreground",
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
                  isLoading && "text-shimmer",
                )}
              >
                {integration?.name || "Integration"}
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
              <Icon
                className={cn("text-sm", isExpanded && "rotate-90")}
                name="chevron_right"
              />
            </div>
          </div>
          {integration?.description && (
            <div className="text-xs text-muted-foreground/70 truncate mt-0.5">
              {integration.description}
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div
          ref={contentRef}
          className="text-left mt-2 space-y-3 w-full min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Input Section */}
          {part.input !== undefined && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
                <Icon name="arrow_downward" className="size-3" />
                Input
              </div>
              <JsonViewer
                data={part.input}
                defaultView="tree"
                maxHeight="300px"
              />
            </div>
          )}

          {/* Output Section */}
          {hasOutput && part.output !== undefined && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
                <Icon name="arrow_upward" className="size-3" />
                Output
              </div>
              <JsonViewer
                data={part.output}
                defaultView="tree"
                maxHeight="300px"
              />
            </div>
          )}

          {/* Error Section */}
          {hasError && (
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
        </div>
      )}
    </div>
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

  const toolName = useMemo(
    () => input?.params?.name ?? null,
    [input?.params?.name],
  );
  const integrationId = useMemo(() => input?.id ?? null, [input?.id]);

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
  const { data: integrations = [] } = useIntegrations();
  const { locator } = useSDK();
  const { pinTab } = usePinnedTabs(locator);
  const { toolName: rawToolName, integrationId, uri } = useCallToolInfo(part);
  const toolName = rawToolName ?? undefined;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const integration = useMemo(() => {
    if (!integrationId) return null;
    return integrations.find((i) => i.id === integrationId) ?? null;
  }, [integrationId, integrations]);

  const toolDescription = useMemo(() => {
    if (!integration?.tools || !toolName) return null;
    const tool = integration.tools.find((t) => t.name === toolName);
    return tool?.description || null;
  }, [integration?.tools, toolName]);

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

  const statusConfig = useMemo(() => getStatusStyles(part.state), [part.state]);
  const isLoading =
    part.state === "input-streaming" || part.state === "input-available";
  const hasOutput = part.state === "output-available";
  const hasError = part.state === "output-error";

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
        ? (part.output as { structuredContent?: { uri?: string } } | undefined)
        : undefined;

    return extractResourceUri("CALL_TOOL", toolInput, toolOutput);
  }, [part.input, part.state, part.output]);

  // Detect if this is a CREATE operation
  const isCreateOperation = useMemo(() => {
    return toolName?.includes("_CREATE") ?? false;
  }, [toolName]);

  // Automatically open/activate tab when resource URI becomes available (once)
  useEffect(() => {
    if (
      resourceUri &&
      part.state === "output-available" &&
      !hasOpenedTabRef.current
    ) {
      hasOpenedTabRef.current = true;
      openResourceTab(
        resourceUri,
        tabs,
        integrations,
        addTab,
        setActiveTab,
        pinTab,
        isCreateOperation,
      );
    }
  }, [
    resourceUri,
    part.state,
    tabs,
    integrations,
    addTab,
    setActiveTab,
    pinTab,
    isCreateOperation,
  ]);

  // Handle opening resource in tab or toggling expansion
  const handleClick = useCallback(() => {
    if (resourceUri) {
      // Open in tab if resource URI exists (using shared utility)
      // Don't auto-pin on manual clicks, only on automatic opens after creation
      openResourceTab(resourceUri, tabs, integrations, addTab, setActiveTab);
    } else {
      // Toggle expansion if no resource URI
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

  return (
    <div className="flex flex-col relative p-2.5 hover:bg-accent/25 rounded-2xl max-w-4xl">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-2 text-sm text-muted-foreground transition-colors cursor-pointer hover:text-foreground",
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
                  isLoading && "text-shimmer",
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
              {copyButton}
              {!resourceUri && (
                <Icon
                  className={cn("text-sm", isExpanded && "rotate-90")}
                  name="chevron_right"
                />
              )}
            </div>
          </div>
          {toolDescription && (
            <div className="text-xs text-muted-foreground/70 truncate mt-0.5">
              {toolDescription}
            </div>
          )}
        </div>
      </div>

      {/* Expandable input/output section when no resourceUri */}
      {!resourceUri && isExpanded && (
        <div
          ref={contentRef}
          className="text-left mt-2 space-y-3 w-full min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Input Section */}
          {part.input !== undefined && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
                <Icon name="arrow_downward" className="size-3" />
                Input
              </div>
              <JsonViewer
                data={part.input}
                defaultView="tree"
                maxHeight="300px"
              />
            </div>
          )}

          {/* Output Section */}
          {hasOutput && part.output !== undefined && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
                <Icon name="arrow_upward" className="size-3" />
                Output
              </div>
              <JsonViewer
                data={part.output}
                defaultView="tree"
                maxHeight="300px"
              />
            </div>
          )}

          {/* Error Section */}
          {hasError && (
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
        </div>
      )}

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
