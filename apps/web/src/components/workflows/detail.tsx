// deno-lint-ignore-file no-explicit-any
import { useWorkflowStatus } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { useState } from "react";
import { useParams } from "react-router";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import WorkflowOverviewPage from "./workflow-overview.tsx";
import { WorkflowFlowVisualization } from "./workflow-flow-visualization.tsx";

function tryParseJson(str: unknown): unknown {
  if (typeof str !== "string") {
    // If it's already an object, return it as-is
    // Don't convert objects to "[object Object]" strings
    return str;
  }
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return str;
  } catch {
    return str;
  }
}

function CopyButton({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(
      typeof value === "string" ? value : JSON.stringify(value, null, 2),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  return (
    <Button
      size="icon"
      variant="ghost"
      className="ml-2"
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      <Icon name={copied ? "check" : "content_copy"} size={16} />
    </Button>
  );
}

// JSON Tree Viewer Components
function ExpandableString({
  value,
  className,
  isQuoted = false,
}: {
  value: string;
  className: string;
  isQuoted?: boolean;
}) {
  const [showFull, setShowFull] = useState(false);

  // Ensure value is actually a string
  const stringValue = typeof value === "string" ? value : String(value);
  const isTruncated = stringValue.length > 100;

  const content = showFull || !isTruncated ? stringValue : (
    <span>
      {stringValue.slice(0, 100)}
      <button
        type="button"
        className="text-primary hover:text-primary/80 underline ml-1 text-xs font-normal bg-transparent border-none cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setShowFull(true);
        }}
        title="Click to show full content"
      >
        ... show {stringValue.length - 100} more chars
      </button>
    </span>
  );

  return (
    <span className={className}>
      {isQuoted && '"'}
      {content}
      {isQuoted && '"'}
      {showFull && isTruncated && (
        <button
          type="button"
          className="text-primary hover:text-primary/80 underline ml-2 text-xs font-normal bg-transparent border-none cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setShowFull(false);
          }}
          title="Click to collapse"
        >
          collapse
        </button>
      )}
    </span>
  );
}

function JsonTreeNode({
  data,
  keyName,
  level = 0,
  _isLast = false,
}: {
  data: unknown;
  keyName?: string;
  level?: number;
  _isLast?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels

  const getDataType = (value: unknown): string => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object") return "object";
    return typeof value;
  };

  const getValuePreview = (value: unknown): string => {
    const type = getDataType(value);
    switch (type) {
      case "array": {
        const arr = value as unknown[];
        return `[${arr.length} items]`;
      }
      case "object": {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        return `{${keys.length} properties}`;
      }
      case "string": {
        const str = value as string;
        return str.length > 50 ? `"${str.slice(0, 50)}..."` : `"${str}"`;
      }
      case "null":
        return "null";
      default:
        return String(value);
    }
  };

  const getTypeColor = (value: unknown): string => {
    const type = getDataType(value);
    switch (type) {
      case "string":
        return "text-green-600 dark:text-green-400";
      case "number":
        return "text-blue-600 dark:text-blue-400";
      case "boolean":
        return "text-purple-600 dark:text-purple-400";
      case "null":
        return "text-gray-500 dark:text-gray-400";
      case "array":
        return "text-orange-600 dark:text-orange-400";
      case "object":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-700 dark:text-gray-300";
    }
  };

  const isExpandable = (value: unknown): boolean => {
    return Array.isArray(value) ||
      (typeof value === "object" && value !== null);
  };

  const renderPrimitive = (value: unknown) => {
    const type = getDataType(value);
    const colorClass = getTypeColor(value);

    if (type === "string") {
      // Ensure we're definitely passing a string
      const stringValue = String(value);
      return (
        <ExpandableString
          value={stringValue}
          className={colorClass}
          isQuoted
        />
      );
    }

    return <span className={colorClass}>{getValuePreview(value)}</span>;
  };

  const renderKey = () => {
    if (!keyName) return null;
    return (
      <span className="text-foreground font-medium">
        "{keyName}":
      </span>
    );
  };

  const indentLevel = level * 16;

  if (!isExpandable(data)) {
    return (
      <div
        className="flex items-start gap-2 py-1 font-mono text-sm"
        style={{ paddingLeft: `${indentLevel}px` }}
      >
        <span className="w-4"></span> {/* Space for expand icon */}
        {renderKey()}
        {renderPrimitive(data)}
      </div>
    );
  }

  const entries = Array.isArray(data)
    ? data.map((item, index) => [String(index), item] as const)
    : Object.entries(data as Record<string, unknown>).map(([key, value]) => {
      // Ensure we're not accidentally stringifying objects
      return [key, value] as const;
    });

  return (
    <div className="font-mono text-sm">
      <div
        className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/30 rounded"
        style={{ paddingLeft: `${indentLevel}px` }}
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
      >
        <Icon
          name={isExpanded ? "expand_more" : "chevron_right"}
          size={16}
          className="text-muted-foreground flex-shrink-0"
        />
        {renderKey()}
        <span className={getTypeColor(data)}>
          {getValuePreview(data)}
        </span>
      </div>

      {isExpanded && (
        <div className="border-l border-border ml-2">
          {entries.map(([key, value], index) => (
            <JsonTreeNode
              key={key}
              data={value}
              keyName={key}
              level={level + 1}
              _isLast={index === entries.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JsonTreeViewer(
  { value, compact = false }: { value: unknown; compact?: boolean },
) {
  const parsed = tryParseJson(value);

  // Handle simple string values
  if (typeof parsed === "string") {
    return (
      <div
        className={compact ? "text-sm" : "bg-muted rounded p-3 text-sm"}
        onClick={(e) => e.stopPropagation()}
      >
        <ExpandableString
          value={parsed}
          className="whitespace-pre-wrap break-words font-mono text-current"
          isQuoted
        />
      </div>
    );
  }

  // Handle null, undefined, or other primitive values
  if (parsed === null || parsed === undefined) {
    return (
      <div
        className={compact ? "text-sm" : "bg-muted rounded p-3 text-sm"}
        onClick={(e) => e.stopPropagation()}
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-current">
          {parsed === null ? "null" : "undefined"}
        </pre>
      </div>
    );
  }

  // Handle other primitive values (numbers, booleans)
  if (typeof parsed !== "object") {
    return (
      <div
        className={compact ? "text-sm" : "bg-muted rounded p-3 text-sm"}
        onClick={(e) => e.stopPropagation()}
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-current">
          {String(parsed)}
        </pre>
      </div>
    );
  }

  // Handle objects and arrays
  return (
    <div
      className={compact ? "max-h-64 overflow-y-auto" : "bg-muted rounded p-3"}
      onClick={(e) => e.stopPropagation()}
    >
      <JsonTreeNode data={parsed} />
    </div>
  );
}

function OutputField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold mr-0">{label}:</span>
        <CopyButton value={value} />
      </div>
      <JsonTreeViewer value={value} />
    </div>
  );
}

function getStatusBadgeVariant(
  status: string,
): "default" | "destructive" | "secondary" | "outline" | "success" {
  if (status === "success" || status === "completed") return "success";
  if (status === "failed" || status === "errored") return "destructive";
  if (status === "running" || status === "in_progress") return "secondary";
  return "outline";
}

function getStatusIcon(status: string) {
  if (status === "success" || status === "completed") {
    return (
      <Icon
        name="check_circle"
        size={18}
        className="text-success"
      />
    );
  } else if (status === "failed" || status === "error") {
    return (
      <Icon
        name="error"
        size={18}
        className="text-destructive"
      />
    );
  } else if (status === "running") {
    return (
      <Icon
        name="sync"
        size={18}
        className="text-primary"
      />
    );
  } else {
    return (
      <Icon
        name="schedule"
        size={18}
        className="text-muted-foreground"
      />
    );
  }
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return "-";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "-";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ${s % 60}s`;
}

function _StatusSummary(
  { success, errors, total }: {
    success: number;
    errors: number;
    total: number;
  },
) {
  const pending = total - success - errors;
  const _running = 0; // This would need to be calculated separately if needed

  if (total === 0) {
    return <div className="text-xs text-muted-foreground">No steps</div>;
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-success rounded-full"></div>
        <span>{success} completed</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-destructive rounded-full"></div>
        <span>{errors} failed</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
        <span>{pending} pending</span>
      </div>
    </div>
  );
}

/**
 * Returns the status of a workflow step based on its data and the overall workflow status.
 */
function _getStepStatus(stepData: any, workflowStatus: string): string {
  if (!stepData) return "pending";
  if (stepData.error) return "failed";
  if (stepData.output && !stepData.error) return "completed";
  if (stepData.startedAt && !stepData.endedAt) return "running";
  if (!stepData.startedAt && !stepData.endedAt) return "pending";
  if (stepData.endedAt && !stepData.output && !stepData.error) return "skipped";
  // Fallback: if workflow is done but step has no data, mark as skipped
  if (
    (workflowStatus === "failed" || workflowStatus === "completed" ||
      workflowStatus === "success") && !stepData.startedAt
  ) {
    return "skipped";
  }
  return "pending";
}

// Helper function to format step ID for display (remove hyphens, capitalize)
function formatStepId(id: string): string {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Step Detail Modal Component
function StepDetailModal({
  step,
  isOpen,
  onClose,
}: {
  step: any;
  isOpen: boolean;
  onClose: () => void;
}) {
  const stepTitle = formatStepId(step.id);
  const hasError = step.data?.error;
  const hasOutput = step.data?.output;
  const hasInput = step.data?.input;
  const duration = formatDuration(
    step.data?.startedAt
      ? new Date(step.data.startedAt).toISOString()
      : undefined,
    step.data?.endedAt ? new Date(step.data.endedAt).toISOString() : undefined,
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[85vw] !w-[85vw] max-h-[90vh] overflow-hidden flex flex-col sm:!max-w-[85vw]">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl font-semibold">
                {stepTitle}
              </DialogTitle>
              <Badge variant="secondary" className="text-sm">
                {hasError ? "Failed" : hasOutput ? "Completed" : "Pending"}
              </Badge>
              {duration && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Icon name="timer" size={16} />
                  <span>{duration}</span>
                </div>
              )}
            </div>

            {/* Execution Timeline in Header */}
            {step.data && (step.data.startedAt || step.data.endedAt) && (
              <div className="flex flex-col gap-1 text-xs text-muted-foreground mr-8">
                {step.data.startedAt && (
                  <div className="flex items-center gap-1">
                    <Icon name="schedule" size={12} />
                    <span>
                      Started: {new Date(step.data.startedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {step.data.endedAt && (
                  <div className="flex items-center gap-1">
                    <Icon name="schedule" size={12} />
                    <span>
                      Ended: {new Date(step.data.endedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Error Section */}
            {hasError && (
              <div>
                <h3 className="text-lg font-semibold text-destructive mb-3 flex items-center gap-2">
                  <Icon name="error" size={20} />
                  Error
                </h3>
                <Card className="border-destructive/30">
                  <CardContent className="p-4">
                    <JsonTreeViewer value={step.data.error} />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Output Section */}
            {hasOutput && (
              <div>
                <h3 className="text-lg font-semibold text-success mb-3 flex items-center gap-2">
                  <Icon name="check_circle" size={20} />
                  Output
                </h3>
                <Card className="border-success/30">
                  <CardContent className="p-4 min-h-[800px] max-h-[800px] overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto">
                      <JsonTreeViewer value={step.data.output} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Input Section */}
            {hasInput && (
              <div>
                <h3 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
                  <Icon name="input" size={20} />
                  Input
                </h3>
                <Card className="border-primary/30">
                  <CardContent className="p-4">
                    <JsonTreeViewer value={step.data.input} />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// New function to preserve parallel structure
function processStepGraph(graph: any): any[] {
  if (!graph) return [];
  if (Array.isArray(graph)) {
    return graph.map((node) => processStepGraph(node)).flat();
  }

  switch (graph.type) {
    case "step":
      return [{
        id: graph.step.id,
        type: "step",
        node: graph,
        isParallel: false,
      }];
    case "sleep":
      return [{ id: graph.id, type: "sleep", node: graph, isParallel: false }];
    case "sleepUntil":
      return [{
        id: graph.id,
        type: "sleepUntil",
        node: graph,
        isParallel: false,
      }];
    case "waitForEvent":
      return [{
        id: graph.step.id,
        type: "waitForEvent",
        node: graph,
        isParallel: false,
      }];
    case "parallel":
      // Return as a single parallel group
      return [{
        type: "parallel",
        isParallel: true,
        steps: graph.steps.map((step: any) => processStepGraph(step)).flat(),
      }];
    case "if": {
      const result = [{
        id: graph.id,
        type: "if",
        node: graph,
        isParallel: false,
      }];
      if (graph.if) result.push(...processStepGraph(graph.if));
      if (graph.else) result.push(...processStepGraph(graph.else));
      return result;
    }
    case "try": {
      const tryResult = [{
        id: graph.id,
        type: "try",
        node: graph,
        isParallel: false,
      }];
      if (graph.try) tryResult.push(...processStepGraph(graph.try));
      if (graph.catch) tryResult.push(...processStepGraph(graph.catch));
      return tryResult;
    }
    default:
      if (graph.id) {
        return [{
          id: graph.id,
          type: graph.type || "unknown",
          node: graph,
          isParallel: false,
        }];
      }
      return [];
  }
}

// Helper to get all step IDs from processed structure (for backwards compatibility)
function getAllStepIds(processedSteps: any[]): string[] {
  const ids: string[] = [];

  function extractIds(steps: any[]) {
    for (const step of steps) {
      if (step.isParallel) {
        extractIds(step.steps);
      } else if (step.id) {
        ids.push(step.id);
      }
    }
  }

  extractIds(processedSteps);
  return ids;
}

function flattenStepGraph(graph: any, parentKey = "", steps: any[] = []) {
  if (!graph) return steps;
  if (Array.isArray(graph)) {
    graph.forEach((node) => flattenStepGraph(node, parentKey, steps));
    return steps;
  }
  switch (graph.type) {
    case "step":
      steps.push({ id: graph.step.id, type: "step", node: graph });
      break;
    case "sleep":
      steps.push({ id: graph.id, type: "sleep", node: graph });
      break;
    case "sleepUntil":
      steps.push({ id: graph.id, type: "sleepUntil", node: graph });
      break;
    case "waitForEvent":
      steps.push({ id: graph.step.id, type: "waitForEvent", node: graph });
      break;
    case "parallel":
      graph.steps.forEach((n: any) => flattenStepGraph(n, parentKey, steps));
      break;
    case "if":
      steps.push({ id: graph.id, type: "if", node: graph });
      if (graph.if) flattenStepGraph(graph.if, parentKey, steps);
      if (graph.else) flattenStepGraph(graph.else, parentKey, steps);
      break;
    case "try":
      steps.push({ id: graph.id, type: "try", node: graph });
      if (graph.try) flattenStepGraph(graph.try, parentKey, steps);
      if (graph.catch) flattenStepGraph(graph.catch, parentKey, steps);
      break;
    default:
      if (graph.id) {
        steps.push({
          id: graph.id,
          type: graph.type || "unknown",
          node: graph,
        });
      }
      break;
  }
  return steps;
}

function StepCard({
  step,
  _workflowStatus,
  _isPreview = false,
  isCurrent = false,
  isSkipped = false,
}: {
  step: any;
  _workflowStatus: string;
  _isPreview?: boolean;
  isCurrent?: boolean;
  isSkipped?: boolean;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const stepTitle = formatStepId(step.id);
  const hasRun = !!step.data;
  const hasError = step.data?.error;
  const hasOutput = step.data?.output;
  const isRunning = step.data?.startedAt && !step.data?.endedAt;

  // Calculate duration if available
  const duration = formatDuration(
    step.data?.startedAt
      ? new Date(step.data.startedAt).toISOString()
      : undefined,
    step.data?.endedAt ? new Date(step.data.endedAt).toISOString() : undefined,
  );

  // Determine card styling based on state
  let cardClasses =
    "relative transition-all duration-200 cursor-pointer hover:shadow-md";
  let borderClasses = "";
  let bgClasses = "";

  if (isSkipped) {
    cardClasses += " opacity-60";
    borderClasses = "border-muted";
    bgClasses = "bg-muted/30";
  } else if (hasError) {
    borderClasses = "border-red-500";
    bgClasses = "bg-red-50 dark:bg-red-950/20";
  } else if (isRunning) {
    borderClasses = "border-blue-500";
    bgClasses = "bg-blue-50 dark:bg-blue-950/20";
  } else if (isCurrent) {
    borderClasses = "border-orange-500 border-dashed";
    bgClasses = "bg-orange-50 dark:bg-orange-950/20";
  } else {
    borderClasses = "border-muted";
    bgClasses = "bg-card";
  }

  return (
    <>
      <Card
        className={`${cardClasses} ${borderClasses} ${bgClasses} w-full`}
        onClick={() => setIsModalOpen(true)}
      >
        <CardContent className="p-3 sm:p-4 flex flex-col">
          {/* Header - always visible */}
          <div className="flex items-center gap-3">
            {/* Status icon */}
            <div className="flex-shrink-0 flex items-center justify-center">
              {isSkipped
                ? (
                  <Icon
                    name="remove_circle"
                    size={16}
                    className="text-muted-foreground"
                  />
                )
                : hasError
                ? <Icon name="error" size={16} className="text-destructive" />
                : hasRun && hasOutput
                ? (
                  <Icon
                    name="check_circle"
                    size={16}
                    className="text-success"
                  />
                )
                : isRunning
                ? (
                  <Icon
                    name="hourglass_empty"
                    size={16}
                    className="text-primary animate-spin"
                  />
                )
                : isCurrent
                ? (
                  <Icon
                    name="play_circle"
                    size={16}
                    className="text-warning"
                  />
                )
                : (
                  <Icon
                    name="radio_button_unchecked"
                    size={16}
                    className="text-muted-foreground"
                  />
                )}
            </div>

            {/* Step title, status badge, and duration */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{stepTitle}</h3>
              <Badge
                variant={isSkipped
                  ? "outline"
                  : hasError
                  ? "destructive"
                  : hasRun && hasOutput
                  ? "success"
                  : isRunning
                  ? "secondary"
                  : isCurrent
                  ? "secondary"
                  : "outline"}
                className="text-xs flex-shrink-0"
              >
                {isSkipped
                  ? "Skipped"
                  : hasError
                  ? "Failed"
                  : hasRun && hasOutput
                  ? "Completed"
                  : isRunning
                  ? "Running"
                  : isCurrent
                  ? "Next"
                  : "Pending"}
              </Badge>
              {/* Duration with timer icon */}
              {duration && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                  <Icon
                    name="timer"
                    size={12}
                    className="text-muted-foreground"
                  />
                  {duration}
                </span>
              )}
            </div>

            {/* View details icon */}
            <div className="flex-shrink-0 flex items-center justify-center">
              <Icon
                name="open_in_new"
                size={16}
                className="text-muted-foreground"
              />
            </div>
          </div>

          {/* Hint text */}
          <div className="text-xs text-muted-foreground mt-2">
            Click to view details
          </div>
        </CardContent>
      </Card>

      {/* Step Detail Modal */}
      <StepDetailModal
        step={step}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

// New component to render parallel steps with much better UI
function _ParallelStepsGroup({
  steps,
  contextMap,
  workflowStatus,
  allStepIds,
  lastRunIdx,
  isWorkflowDone,
}: {
  steps: any[];
  contextMap: any;
  workflowStatus: string;
  allStepIds: string[];
  lastRunIdx: number;
  isWorkflowDone: boolean;
}) {
  return (
    <div className="w-full relative">
      {/* Flow connection from previous step */}
      <div className="flex justify-center mb-4">
        <div className="w-0.5 h-8 bg-border"></div>
      </div>

      {/* Clean header */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center gap-3 bg-primary/10 px-4 py-2 rounded-lg border border-primary/30">
          <Icon
            name="call_split"
            size={16}
            className="text-primary"
          />
          <span className="text-sm font-medium text-primary">
            Parallel Execution ({steps.length} steps)
          </span>
        </div>
      </div>

      {/* Simple grid layout with left border to show grouping */}
      <div className="border-l-4 border-primary/50 pl-4 sm:pl-6 ml-2 sm:ml-4">
        <div
          className={`grid gap-3 sm:gap-4 ${
            steps.length === 1
              ? "grid-cols-1"
              : steps.length === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : steps.length === 3
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              : steps.length === 4
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
              : steps.length === 5
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
              : steps.length >= 6
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {steps.map((step) => {
            const hasRun = !!contextMap[step.id];
            const isSkipped = isWorkflowDone && !hasRun;
            const stepIndex = allStepIds.indexOf(step.id);

            return (
              <div key={step.id}>
                <StepCard
                  step={{ ...step, data: contextMap[step.id] }}
                  _workflowStatus={workflowStatus}
                  _isPreview={!contextMap[step.id] && !isSkipped}
                  isCurrent={stepIndex === lastRunIdx + 1 &&
                    !contextMap[step.id] && !isSkipped}
                  isSkipped={isSkipped}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Status summary */}
      <div className="flex justify-center mt-6 mb-4 px-2">
        <div className="bg-muted/50 rounded-lg px-3 sm:px-4 py-2 border max-w-full">
          <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground flex-wrap justify-center">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span>
                {steps.filter((s) =>
                  contextMap[s.id]?.output && !contextMap[s.id]?.error
                ).length} completed
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-destructive rounded-full"></div>
              <span>
                {steps.filter((s) => contextMap[s.id]?.error).length} failed
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse">
              </div>
              <span>
                {steps.filter((s) =>
                  contextMap[s.id]?.startedAt && !contextMap[s.id]?.endedAt
                ).length} running
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
              <span>
                {steps.filter((s) => !contextMap[s.id]).length} pending
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Flow connection to next step */}
      <div className="flex justify-center">
        <div className="w-0.5 h-8 bg-border"></div>
      </div>
    </div>
  );
}

function _StepWithFlow({
  step,
  contextMap,
  workflowStatus,
  allStepIds,
  lastRunIdx,
  isWorkflowDone,
  _isLast = false,
}: {
  step: any;
  contextMap: any;
  workflowStatus: string;
  allStepIds: string[];
  lastRunIdx: number;
  isWorkflowDone: boolean;
  _isLast?: boolean;
}) {
  const hasRun = !!contextMap[step.id];
  const isSkipped = isWorkflowDone && !hasRun;
  const stepIndex = allStepIds.indexOf(step.id);

  return (
    <div className="relative">
      {/* Flow connection from previous step */}
      <div className="flex justify-center mb-4">
        <div className="w-0.5 h-8 bg-border"></div>
      </div>

      {/* Step card */}
      <div>
        <StepCard
          step={{ ...step, data: contextMap[step.id] }}
          _workflowStatus={workflowStatus}
          _isPreview={!contextMap[step.id] && !isSkipped}
          isCurrent={stepIndex === lastRunIdx + 1 && !contextMap[step.id] &&
            !isSkipped}
          isSkipped={isSkipped}
        />
      </div>

      {/* Flow connection to next step (unless it's the last step) */}
      {!_isLast && (
        <div className="flex justify-center mt-4">
          <div className="w-0.5 h-8 bg-border"></div>
        </div>
      )}
    </div>
  );
}

function InstanceDetailTab() {
  const { workflowName = "", instanceId = "" } = useParams();
  const { data } = useWorkflowStatus(workflowName, instanceId);

  // 🔍 DEBUG: API Response Structure
  console.log("🚀 WORKFLOW API DATA:", data);
  console.log("📋 WORKFLOW API RAW (copy me):", JSON.stringify(data, null, 2));

  const snapshot = data?.snapshot;
  const status = typeof snapshot === "string"
    ? snapshot
    : snapshot?.status || "unknown";

  const badgeVariant = getStatusBadgeVariant(status);
  const statusIcon = getStatusIcon(status);
  const context = typeof snapshot === "string" ? undefined : snapshot?.context;
  const stepGraph = typeof snapshot === "string"
    ? []
    : snapshot?.serializedStepGraph || [];

  // Use new processStepGraph to preserve parallel structure
  const processedSteps = processStepGraph(stepGraph);
  // Keep backwards compatibility for calculations
  const allSteps = flattenStepGraph(stepGraph);
  const _allStepIds = getAllStepIds(processedSteps);

  // Map step IDs to run data
  const contextMap = context || {};
  // Find the last completed or running step index
  let _lastRunIdx = -1;
  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (
      contextMap[step.id] &&
      (contextMap[step.id].output || contextMap[step.id].error ||
        contextMap[step.id].startedAt)
    ) {
      _lastRunIdx = i;
    }
  }
  // The next step to run is lastRunIdx + 1

  // Determine if workflow is done but there are steps left to run
  const _isWorkflowDone = status === "success" || status === "failed";

  // For duration, use the earliest startedAt and latest endedAt among steps
  const startedAts = Object.values(contextMap)
    .map((s: any) => s.startedAt)
    .filter((v): v is number => typeof v === "number");
  const endedAts = Object.values(contextMap)
    .map((s: any) => s.endedAt)
    .filter((v): v is number => typeof v === "number");
  const duration = formatDuration(
    startedAts.length
      ? new Date(Math.min(...startedAts)).toISOString()
      : undefined,
    endedAts.length ? new Date(Math.max(...endedAts)).toISOString() : undefined,
  );

  const _errors = allSteps.filter((step) => contextMap[step.id]?.error).length;
  const _successes =
    allSteps.filter((step) =>
      contextMap[step.id]?.output && !contextMap[step.id]?.error
    ).length;

  return (
    <ScrollArea className="h-full">
      <div className="w-full px-4 sm:px-6 py-8">
        <div className="max-w-8xl mx-auto">
          <Card className="p-0 mb-6 shadow-lg border-2 border-muted">
            <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-2">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 flex-wrap">
                  {statusIcon}
                  <span className="text-xl font-bold">Status</span>
                  <Badge
                    variant={badgeVariant}
                    className="text-base px-3 py-1 capitalize"
                  >
                    {status}
                  </Badge>
                  <Icon
                    name="timer"
                    size={18}
                    className="text-muted-foreground"
                  />
                  <span className="font-semibold text-base">Duration:</span>
                  <span className="text-sm font-mono bg-muted rounded px-2 py-1">
                    {duration}
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon
                    name="key"
                    size={16}
                    className="text-muted-foreground"
                  />
                  <span className="font-semibold text-sm">Instance ID:</span>
                  <span className="text-xs font-mono bg-muted rounded px-2 py-1">
                    {instanceId}
                  </span>
                  <CopyButton value={instanceId} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon
                    name="calendar_today"
                    size={16}
                    className="text-muted-foreground"
                  />
                  <span className="font-semibold text-sm">Started:</span>
                  <span className="text-xs font-mono bg-muted rounded px-2 py-1">
                    {startedAts.length
                      ? new Date(Math.min(...startedAts)).toLocaleString()
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon
                    name="calendar_today"
                    size={16}
                    className="text-muted-foreground"
                  />
                  <span className="font-semibold text-sm">Ended:</span>
                  <span className="text-xs font-mono bg-muted rounded px-2 py-1">
                    {endedAts.length
                      ? new Date(Math.max(...endedAts)).toLocaleString()
                      : "-"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="p-3 sm:p-4 mb-4">
            <OutputField
              label="Input Params"
              value={context?.input}
            />
            <OutputField
              label="Output"
              value={typeof snapshot === "string"
                ? undefined
                : snapshot?.result}
            />
          </Card>
          <h2 className="text-lg font-semibold mb-4">Steps</h2>

          {/* React Flow-based workflow visualization */}
          <WorkflowFlowVisualization
            processedSteps={processedSteps}
            contextMap={contextMap}
            workflowStatus={status}
          />
        </div>
      </div>
    </ScrollArea>
  );
}

const tabs: Record<string, Tab> = {
  instance: {
    Component: InstanceDetailTab,
    title: "Instance Details",
    active: true,
    initialOpen: true,
  },
};

function WorkflowDetailPage() {
  const { workflowName = "", instanceId } = useParams();

  // If there's no instanceId, show the workflow overview
  if (!instanceId) {
    return <WorkflowOverviewPage />;
  }

  // If there's an instanceId, show the instance detail
  return (
    <PageLayout
      hideViewsButton
      tabs={tabs}
      breadcrumb={
        <DefaultBreadcrumb
          items={[
            { label: "Workflows", link: "/workflows" },
            {
              label: String(workflowName ?? ""),
              link: `/workflows/${encodeURIComponent(workflowName)}`,
            },
            {
              label: `Instance ${instanceId?.slice(0, 8)}...`,
            },
          ]}
        />
      }
    />
  );
}

export default WorkflowDetailPage;
