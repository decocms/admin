// deno-lint-ignore-file no-explicit-any
import { useWorkflowStatus } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useState } from "react";
import { useParams } from "react-router";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import WorkflowOverviewPage from "./workflow-overview.tsx";

function tryParseJson(str: unknown): unknown {
  if (typeof str !== "string") return str;
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

function JsonBlock({ value }: { value: unknown }) {
  const parsed = tryParseJson(value);
  return (
    <pre className="bg-muted rounded p-2 text-xs w-full max-w-full max-h-64 overflow-x-auto overflow-y-auto">
      {typeof parsed === "string"
        ? parsed
        : JSON.stringify(parsed, null, 2)}
    </pre>
  );
}

function OutputField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold mr-0">{label}:</span>
        <CopyButton value={value} />
      </div>
      {<JsonBlock value={value} />}
    </div>
  );
}

function getStatusBadgeVariant(
  status: string,
): "default" | "destructive" | "secondary" | "outline" {
  if (status === "success" || status === "completed") return "default";
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
        className="text-green-500"
      />
    );
  } else if (status === "failed" || status === "error") {
    return (
      <Icon
        name="error"
        size={18}
        className="text-red-500"
      />
    );
  } else if (status === "running") {
    return (
      <Icon
        name="sync"
        size={18}
        className="text-blue-500"
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

const DONUT_COLORS = ["#22c55e", "#ef4444", "#a3a3a3"];

function DonutChart(
  { success, errors, total }: {
    success: number;
    errors: number;
    total: number;
  },
) {
  const data = [
    { name: "Success", value: success, color: "#22c55e" },
    { name: "Errors", value: errors, color: "#ef4444" },
    { name: "Pending", value: total - success - errors, color: "#94a3b8" },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return <div className="text-xs text-muted-foreground">No data</div>;
  }

  return (
    <ResponsiveContainer width={60} height={60}>
      <PieChart>
        <Pie
          data={data}
          cx={30}
          cy={30}
          innerRadius={18}
          outerRadius={28}
          paddingAngle={2}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

/**
 * Returns the status of a workflow step based on its data and the overall workflow status.
 */
function getStepStatus(stepData: any, workflowStatus: string): string {
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
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// New function to preserve parallel structure
function processStepGraph(graph: any): any[] {
  if (!graph) return [];
  if (Array.isArray(graph)) {
    return graph.map(node => processStepGraph(node)).flat();
  }
  
  switch (graph.type) {
    case "step":
      return [{ id: graph.step.id, type: "step", node: graph, isParallel: false }];
    case "sleep":
      return [{ id: graph.id, type: "sleep", node: graph, isParallel: false }];
    case "sleepUntil":
      return [{ id: graph.id, type: "sleepUntil", node: graph, isParallel: false }];
    case "waitForEvent":
      return [{ id: graph.step.id, type: "waitForEvent", node: graph, isParallel: false }];
    case "parallel":
      // Return as a single parallel group
      return [{
        type: "parallel", 
        isParallel: true,
        steps: graph.steps.map((step: any) => processStepGraph(step)).flat()
      }];
    case "if":
      const result = [{ id: graph.id, type: "if", node: graph, isParallel: false }];
      if (graph.if) result.push(...processStepGraph(graph.if));
      if (graph.else) result.push(...processStepGraph(graph.else));
      return result;
    case "try":
      const tryResult = [{ id: graph.id, type: "try", node: graph, isParallel: false }];
      if (graph.try) tryResult.push(...processStepGraph(graph.try));
      if (graph.catch) tryResult.push(...processStepGraph(graph.catch));
      return tryResult;
    default:
      if (graph.id) {
        return [{ id: graph.id, type: graph.type || "unknown", node: graph, isParallel: false }];
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
        steps.push({ id: graph.id, type: graph.type || "unknown", node: graph });
      }
      break;
  }
  return steps;
}

function StepCard({
  step,
  workflowStatus,
  isPreview = false,
  isCurrent = false,
  isSkipped = false,
}: {
  step: any;
  workflowStatus: string;
  isPreview?: boolean;
  isCurrent?: boolean;
  isSkipped?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const stepTitle = formatStepId(step.id);
  const hasRun = !!step.data;
  const hasError = step.data?.error;
  const hasOutput = step.data?.output;
  const isRunning = step.data?.startedAt && !step.data?.endedAt;

  // Calculate duration if available
  const duration = formatDuration(
    step.data?.startedAt ? new Date(step.data.startedAt).toISOString() : undefined,
    step.data?.endedAt ? new Date(step.data.endedAt).toISOString() : undefined,
  );

  // Determine card styling based on state
  let cardClasses = "relative transition-all duration-200 cursor-pointer hover:shadow-md";
  let borderClasses = "";
  let bgClasses = "";

  if (isSkipped) {
    cardClasses += " opacity-60";
    borderClasses = "border-muted";
    bgClasses = "bg-muted/30";
  } else if (hasError) {
    borderClasses = "border-red-500";
    bgClasses = "bg-red-50 dark:bg-red-950/20";
  } else if (hasRun && hasOutput) {
    borderClasses = "border-green-500";
    bgClasses = "bg-green-50 dark:bg-green-950/20";
  } else if (isRunning) {
    borderClasses = "border-blue-500";
    bgClasses = "bg-blue-50 dark:bg-blue-950/20";
  } else if (isCurrent) {
    borderClasses = "border-orange-500 border-dashed";
    bgClasses = "bg-orange-50 dark:bg-orange-950/20";
  } else {
    borderClasses = "border-muted";
    bgClasses = "bg-muted/10";
  }

  return (
    <Card className={`${cardClasses} ${borderClasses} ${bgClasses} min-h-[120px]`} onClick={() => setIsExpanded(!isExpanded)}>
      <CardContent className="p-4 flex flex-col">
        {/* Header - always visible */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Status icon */}
            <div className="flex-shrink-0">
              {isSkipped ? (
                <Icon name="remove_circle" size={16} style={{ color: "#9ca3af" }} />
              ) : hasError ? (
                <Icon name="error" size={16} style={{ color: "#ef4444" }} />
              ) : hasRun && hasOutput ? (
                <Icon name="check_circle" size={16} style={{ color: "#22c55e" }} />
              ) : isRunning ? (
                <Icon name="hourglass_empty" size={16} style={{ color: "#3b82f6" }} className="animate-spin" />
              ) : isCurrent ? (
                <Icon name="play_circle" size={16} style={{ color: "#f59e0b" }} />
              ) : (
                <Icon name="radio_button_unchecked" size={16} style={{ color: "#9ca3af" }} />
              )}
            </div>
            
            {/* Step title */}
            <h3 className="font-semibold text-sm truncate flex-1">{stepTitle}</h3>
            
            {/* Expand/collapse icon */}
            <Icon 
              name={isExpanded ? "expand_less" : "expand_more"} 
              size={16} 
              style={{ color: "#6b7280" }}
              className="flex-shrink-0"
            />
          </div>
          
          {/* Duration badge */}
          {duration && (
            <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
              {duration}
            </Badge>
          )}
        </div>

        {/* Status line - always visible */}
        <div className="text-xs text-muted-foreground mb-2">
          {isSkipped
            ? "Skipped"
            : hasError
            ? "Failed"
            : hasRun && hasOutput
            ? "Completed"
            : isRunning
            ? "Running..."
            : isCurrent
            ? "Next to run"
            : "Pending"}
        </div>

        {/* Expandable content */}
        {isExpanded && (
          <div className="space-y-3 flex-1">
            {/* Output/Error content */}
            {hasError && (
              <div>
                <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
                  Error
                </h4>
                <div className="bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded p-2">
                  <pre className="text-xs text-red-800 dark:text-red-200 whitespace-pre-wrap font-mono">
                    {typeof step.data.error === "string"
                      ? step.data.error
                      : JSON.stringify(step.data.error, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {hasOutput && (
              <div>
                <h4 className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">
                  Output
                </h4>
                <div className="bg-green-100 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded p-2">
                  <pre className="text-xs text-green-800 dark:text-green-200 whitespace-pre-wrap font-mono">
                    {typeof step.data.output === "string"
                      ? step.data.output
                      : JSON.stringify(step.data.output, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Input if available */}
            {step.data?.input && (
              <div>
                <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                  Input
                </h4>
                <div className="bg-blue-100 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded p-2">
                  <pre className="text-xs text-blue-800 dark:text-blue-200 whitespace-pre-wrap font-mono">
                    {typeof step.data.input === "string"
                      ? step.data.input
                      : JSON.stringify(step.data.input, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Timestamps */}
            {step.data && (step.data.startedAt || step.data.endedAt) && (
              <div className="pt-2 border-t border-muted-foreground/20">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {step.data.startedAt && (
                    <div>
                      <span className="font-medium">Started:</span>
                      <div className="font-mono">
                        {new Date(step.data.startedAt).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {step.data.endedAt && (
                    <div>
                      <span className="font-medium">Ended:</span>
                      <div className="font-mono">
                        {new Date(step.data.endedAt).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hint text when collapsed */}
        {!isExpanded && (hasOutput || hasError || step.data?.input) && (
          <div className="text-xs text-muted-foreground italic mt-auto">
            Click to view details
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// New component to render parallel steps with much better UI
function ParallelStepsGroup({ 
  steps, 
  contextMap, 
  workflowStatus, 
  allStepIds, 
  lastRunIdx, 
  isWorkflowDone 
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
        <div className="w-0.5 h-8 bg-gray-300"></div>
      </div>

      {/* Clean header */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950/30 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
          <Icon name="call_split" size={16} className="text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Parallel Execution ({steps.length} steps)
          </span>
        </div>
      </div>

      {/* Simple grid layout with left border to show grouping */}
      <div className="border-l-4 border-blue-300 pl-6 ml-4">
        <div className={`grid gap-4 ${
          steps.length === 1 ? 'grid-cols-1' :
          steps.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
          steps.length === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
          steps.length === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
          steps.length === 5 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5' :
          steps.length >= 6 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5' :
          'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {steps.map((step) => {
            const hasRun = !!contextMap[step.id];
            const isSkipped = isWorkflowDone && !hasRun;
            const stepIndex = allStepIds.indexOf(step.id);
            
            return (
              <div key={step.id}>
                <StepCard
                  step={{ ...step, data: contextMap[step.id] }}
                  workflowStatus={workflowStatus}
                  isPreview={!contextMap[step.id] && !isSkipped}
                  isCurrent={stepIndex === lastRunIdx + 1 && !contextMap[step.id] && !isSkipped}
                  isSkipped={isSkipped}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Status summary */}
      <div className="flex justify-center mt-6 mb-4">
        <div className="bg-muted/50 rounded-lg px-4 py-2 border">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{steps.filter(s => contextMap[s.id]?.output && !contextMap[s.id]?.error).length} completed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>{steps.filter(s => contextMap[s.id]?.error).length} failed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>{steps.filter(s => contextMap[s.id]?.startedAt && !contextMap[s.id]?.endedAt).length} running</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span>{steps.filter(s => !contextMap[s.id]).length} pending</span>
            </div>
          </div>
        </div>
      </div>

      {/* Flow connection to next step */}
      <div className="flex justify-center">
        <div className="w-0.5 h-8 bg-gray-300"></div>
      </div>
    </div>
  );
}

// Component for individual steps with flow connection
function StepWithFlow({ 
  step, 
  contextMap, 
  workflowStatus, 
  allStepIds, 
  lastRunIdx, 
  isWorkflowDone,
  isLast = false
}: {
  step: any;
  contextMap: any;
  workflowStatus: string;
  allStepIds: string[];
  lastRunIdx: number;
  isWorkflowDone: boolean;
  isLast?: boolean;
}) {
  const hasRun = !!contextMap[step.id];
  const isSkipped = isWorkflowDone && !hasRun;
  const stepIndex = allStepIds.indexOf(step.id);

  return (
    <div className="relative">
      {/* Flow connection from previous step */}
      <div className="flex justify-center mb-4">
        <div className="w-0.5 h-8 bg-gray-300"></div>
      </div>

      {/* Step card */}
      <div>
        <StepCard
          step={{ ...step, data: contextMap[step.id] }}
          workflowStatus={workflowStatus}
          isPreview={!contextMap[step.id] && !isSkipped}
          isCurrent={stepIndex === lastRunIdx + 1 && !contextMap[step.id] && !isSkipped}
          isSkipped={isSkipped}
        />
      </div>

      {/* Flow connection to next step (unless it's the last step) */}
      {!isLast && (
        <div className="flex justify-center mt-4">
          <div className="w-0.5 h-8 bg-gray-300"></div>
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
  const allStepIds = getAllStepIds(processedSteps);

  // Map step IDs to run data
  const contextMap = context || {};
  // Find the last completed or running step index
  let lastRunIdx = -1;
  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (
      contextMap[step.id] &&
      (contextMap[step.id].output || contextMap[step.id].error ||
        contextMap[step.id].startedAt)
    ) {
      lastRunIdx = i;
    }
  }
  // The next step to run is lastRunIdx + 1

  // Determine if workflow is done but there are steps left to run
  const isWorkflowDone = status === "success" || status === "failed";

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

  const errors = allSteps.filter((step) => contextMap[step.id]?.error).length;
  const successes =
    allSteps.filter((step) =>
      contextMap[step.id]?.output && !contextMap[step.id]?.error
    ).length;

  return (
    <ScrollArea className="h-full">
      <div className="w-full px-6 py-8">
        <div className="max-w-5xl">
          <Card className="p-0 mb-6 shadow-lg border-2 border-muted">
            <CardContent className="p-6 flex flex-col gap-4">
              <div className="flex flex-row items-center gap-4 mb-2">
                <div className="flex items-center gap-3 flex-1">
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
                <div className="min-w-[60px] flex-shrink-0 flex items-center justify-center">
                  <DonutChart
                    success={successes}
                    errors={errors}
                    total={allSteps.length}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Icon name="key" size={16} className="text-muted-foreground" />
                  <span className="font-semibold text-sm">Instance ID:</span>
                  <span className="text-xs font-mono bg-muted rounded px-2 py-1">
                    {instanceId}
                  </span>
                  <CopyButton value={instanceId} />
                </div>
                <div className="flex items-center gap-2">
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
                <div className="flex items-center gap-2">
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
          <Card className="p-4 mb-4">
            <OutputField
              label="Input Params"
              value={context?.input}
            />
            <OutputField
              label="Output"
              value={typeof snapshot === "string" ? undefined : snapshot?.result}
            />
          </Card>
          <h2 className="text-lg font-semibold mb-4">Steps</h2>
          
          {/* Workflow flow visualization */}
          <div className="relative">
            {/* Start indicator */}
            <div className="flex justify-center mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-lg"></div>
            </div>

            {processedSteps.length > 0
              ? (
                processedSteps.map((step, i) => {
                  const isLast = i === processedSteps.length - 1;
                  
                  if (step.isParallel) {
                    // Render parallel steps group with flow connections
                    return (
                      <ParallelStepsGroup
                        key={`parallel-${i}`}
                        steps={step.steps}
                        contextMap={contextMap}
                        workflowStatus={status}
                        allStepIds={allStepIds}
                        lastRunIdx={lastRunIdx}
                        isWorkflowDone={isWorkflowDone}
                      />
                    );
                  } else {
                    // Render single step with flow connections
                    return (
                      <StepWithFlow
                        key={step.id}
                        step={step}
                        contextMap={contextMap}
                        workflowStatus={status}
                        allStepIds={allStepIds}
                        lastRunIdx={lastRunIdx}
                        isWorkflowDone={isWorkflowDone}
                        isLast={isLast}
                      />
                    );
                  }
                })
              )
              : <div className="text-muted-foreground text-center py-8">No steps found.</div>}

            {/* End indicator */}
            {processedSteps.length > 0 && (
              <div className="flex justify-center mt-4">
                <div className="w-3 h-3 bg-gray-400 rounded-full border-2 border-white shadow-lg"></div>
              </div>
            )}
          </div>
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
              link: `/workflows/${encodeURIComponent(workflowName)}`
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
