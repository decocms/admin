/* oxlint-disable no-explicit-any */
import { useWorkflowStatus } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useMemo } from "react";
import { useParams } from "react-router";
import { useRouteParams } from "../canvas/route-params-provider.tsx";
import { useSetThreadContextEffect } from "../decopilot/thread-context-provider.tsx";
import { WorkflowFlowVisualization } from "./workflow-flow-visualization.tsx";
import { useResourceWatch } from "../../hooks/use-resource-watch.ts";
import { JsonTreeViewer } from "../common/json-tree-viewer.tsx";
import { useCopy } from "../../hooks/use-copy.ts";

export function CopyButton({ value }: { value: unknown }) {
  const { handleCopy, copied } = useCopy();

  return (
    <Button
      size="icon"
      variant="ghost"
      className="ml-2"
      onClick={(e) => {
        e.stopPropagation();
        handleCopy(
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
        );
      }}
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      <Icon name={copied ? "check" : "content_copy"} size={16} />
    </Button>
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
    return <Icon name="check_circle" size={18} className="text-success" />;
  } else if (status === "failed" || status === "error") {
    return <Icon name="error" size={18} className="text-destructive" />;
  } else if (status === "running") {
    return <Icon name="sync" size={18} className="text-primary" />;
  } else {
    return <Icon name="schedule" size={18} className="text-muted-foreground" />;
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

// New function to preserve parallel structure
function processStepGraph(graph: any): any[] {
  if (!graph) return [];
  if (Array.isArray(graph)) {
    return graph.map((node) => processStepGraph(node)).flat();
  }

  switch (graph.type) {
    case "step":
      return [
        {
          id: graph.step.id,
          type: "step",
          node: graph,
          isParallel: false,
        },
      ];
    case "sleep":
      return [{ id: graph.id, type: "sleep", node: graph, isParallel: false }];
    case "sleepUntil":
      return [
        {
          id: graph.id,
          type: "sleepUntil",
          node: graph,
          isParallel: false,
        },
      ];
    case "waitForEvent":
      return [
        {
          id: graph.step.id,
          type: "waitForEvent",
          node: graph,
          isParallel: false,
        },
      ];
    case "parallel":
      // Return as a single parallel group
      return [
        {
          type: "parallel",
          isParallel: true,
          steps: graph.steps.map((step: any) => processStepGraph(step)).flat(),
        },
      ];
    case "if": {
      const result = [
        {
          id: graph.id,
          type: "if",
          node: graph,
          isParallel: false,
        },
      ];
      if (graph.if) result.push(...processStepGraph(graph.if));
      if (graph.else) result.push(...processStepGraph(graph.else));
      return result;
    }
    case "try": {
      const tryResult = [
        {
          id: graph.id,
          type: "try",
          node: graph,
          isParallel: false,
        },
      ];
      if (graph.try) tryResult.push(...processStepGraph(graph.try));
      if (graph.catch) tryResult.push(...processStepGraph(graph.catch));
      return tryResult;
    }
    default:
      if (graph.id) {
        return [
          {
            id: graph.id,
            type: graph.type || "unknown",
            node: graph,
            isParallel: false,
          },
        ];
      }
      return [];
  }
}

function WorkflowDetailContent() {
  // Check for params from RouteParamsProvider (for tab rendering)
  // Fall back to URL params (for direct navigation)
  const routeParams = useRouteParams();
  const urlParams = useParams();
  const workflowName = routeParams.workflowName || urlParams.workflowName || "";
  const instanceId = routeParams.instanceId || urlParams.instanceId || "";
  const { data } = useWorkflowStatus(workflowName, instanceId);

  // Initialize resource watch for this instance
  // Workflows are stored in deconfig at /src/workflows/{name}.json
  const watchEnabled = Boolean(workflowName && instanceId);
  useResourceWatch({
    resourceUri: watchEnabled
      ? `workflow://${workflowName}/instances/${instanceId}`
      : "",
    pathFilter: watchEnabled ? `/src/workflows/${workflowName}.json` : "",
    enabled: watchEnabled,
  });

  // Prepare thread context for workflow detail
  const threadContextItems = useMemo(() => {
    if (!instanceId) return [];

    const rules: string[] = [
      `You are helping with a workflow instance detail view. The current workflow instance ID is "${instanceId}". Focus on operations related to workflow instance monitoring, debugging, and management.`,
      `When working with this workflow instance, prioritize operations that help users understand the instance's execution state, debug issues, monitor progress, and manage the workflow instance lifecycle. Consider the instance's current status and execution history when providing assistance.`,
    ];

    return rules.map((text) => ({
      id: crypto.randomUUID(),
      type: "rule" as const,
      text,
    }));
  }, [instanceId]);

  useSetThreadContextEffect(threadContextItems);

  const snapshot = data?.snapshot;
  const status =
    typeof snapshot === "string" ? snapshot : snapshot?.status || "unknown";

  const badgeVariant = getStatusBadgeVariant(status);
  const statusIcon = getStatusIcon(status);
  const context = typeof snapshot === "string" ? undefined : snapshot?.context;
  const stepGraph =
    typeof snapshot === "string" ? [] : snapshot?.serializedStepGraph || [];

  // Use new processStepGraph to preserve parallel structure
  const processedSteps = processStepGraph(stepGraph);

  // Map step IDs to run data
  const contextMap = context || {};

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
                    size={12}
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
            <OutputField label="Input Params" value={context?.input} />
            <OutputField
              label="Output"
              value={
                typeof snapshot === "string" ? undefined : snapshot?.result
              }
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

export default function WorkflowDetail() {
  return <WorkflowDetailContent />;
}
