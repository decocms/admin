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
    // deno-lint-ignore ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
    return <Icon name="check_circle" className="text-green-500" size={20} />;
  }
  if (status === "failed" || status === "errored") {
    // deno-lint-ignore ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
    return <Icon name="error" className="text-red-500" size={20} />;
  }
  if (status === "running" || status === "in_progress") {
    return (
      <Icon
        name="autorenew"
        className="text-purple-dark animate-spin"
        size={20}
      />
    );
  }
  return <Icon name="info" className="text-muted-foreground" size={20} />;
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
  const rest = Math.max(total - success - errors, 0);
  const data = [
    { name: "Success", value: success },
    { name: "Error", value: errors },
    { name: "Other", value: rest },
  ];
  return (
    <div className="relative w-[60px] h-[60px]">
      <ResponsiveContainer width={60} height={60}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={20}
            outerRadius={28}
            stroke="none"
          >
            {data.map((_entry, idx) => (
              <Cell key={`cell-${idx}`} fill={DONUT_COLORS[idx]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        <span className="text-xs font-bold text-foreground leading-none">
          {total}
        </span>
        <span className="text-[10px] text-muted-foreground leading-none">
          total
        </span>
      </div>
    </div>
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

// Utility to flatten the step graph and extract step IDs and metadata
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
    case "conditional":
      graph.steps.forEach((n: any) => flattenStepGraph(n, parentKey, steps));
      break;
    case "loop":
      steps.push({ id: graph.step.id, type: "loop", node: graph });
      break;
    case "foreach":
      steps.push({ id: graph.step.id, type: "foreach", node: graph });
      break;
    default:
      break;
  }
  return steps;
}

// Enhanced StepCard to support preview and currently running/skipped states
function StepCard(
  { step, workflowStatus, isPreview, isCurrent, isSkipped }: {
    step: { id: string; type: string; node: any; data?: any };
    workflowStatus: string;
    isPreview?: boolean;
    isCurrent?: boolean;
    isSkipped?: boolean;
  },
) {
  const [open, setOpen] = useState(false);
  const stepName = step.id.startsWith("mapping_") ? "mapping" : step.id;
  const stepData = step.data;
  const stepStatus = isSkipped
    ? "skipped"
    : isPreview
    ? (isCurrent ? "running" : "pending")
    : getStepStatus(stepData, workflowStatus);
  const stepBadgeVariant = getStatusBadgeVariant(stepStatus);
  const stepStatusIcon = isSkipped
    ? <Icon name="block" className="text-muted-foreground" size={20} />
    : isPreview
    ? (isCurrent
      ? (
        <Icon
          name="autorenew"
          className="text-purple-dark animate-spin"
          size={20}
        />
      )
      : (
        <Icon
          name="hourglass_empty"
          className="text-muted-foreground"
          size={20}
        />
      ))
    : getStatusIcon(stepStatus);
  const stepDuration = stepData
    ? formatDuration(
      stepData.startedAt
        ? new Date(stepData.startedAt).toISOString()
        : undefined,
      stepData.endedAt ? new Date(stepData.endedAt).toISOString() : undefined,
    )
    : "-";

  return (
    <Card
      className={`p-0 shadow border ${
        isPreview || isSkipped ? "border-dashed opacity-60" : "border-muted"
      } ${isCurrent ? "ring-2 ring-purple-dark" : ""}`}
    >
      <div
        className="flex items-center justify-between cursor-pointer px-4 py-3 border-b"
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center gap-3">
          {stepStatusIcon}
          <span className="text-base font-bold">{stepName}</span>
          <Badge
            variant={stepBadgeVariant}
            className="text-xs px-2 py-0.5 capitalize"
          >
            {stepStatus}
          </Badge>
          {isCurrent && isPreview && (
            <span className="ml-2 text-xs text-purple-dark font-semibold">
              Currently Running
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Icon name="timer" size={14} className="text-muted-foreground" />
          <span className="font-semibold text-xs">Duration:</span>
          <span className="text-xs font-mono bg-muted rounded px-2 py-1">
            {stepDuration}
          </span>
          <Icon
            name={open ? "expand_less" : "expand_more"}
            size={18}
            className="ml-2 text-muted-foreground"
          />
        </div>
      </div>
      {open && !isPreview && !isSkipped && stepData && (
        <CardContent className="p-4 flex flex-col gap-2">
          <div className="flex flex-row items-center gap-4 mb-2">
            <div className="flex flex-wrap gap-4 items-center flex-1">
              <div className="flex items-center gap-2">
                <Icon
                  name="calendar_today"
                  size={14}
                  className="text-muted-foreground"
                />
                <span className="font-semibold text-xs">Started:</span>
                <span className="text-xs font-mono bg-muted rounded px-2 py-1">
                  {stepData.startedAt
                    ? new Date(stepData.startedAt).toLocaleString()
                    : "-"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icon
                  name="calendar_today"
                  size={14}
                  className="text-muted-foreground"
                />
                <span className="font-semibold text-xs">Ended:</span>
                <span className="text-xs font-mono bg-muted rounded px-2 py-1">
                  {stepData.endedAt
                    ? new Date(stepData.endedAt).toLocaleString()
                    : "-"}
                </span>
              </div>
            </div>
          </div>
          {step.id.startsWith("mapping_") && step.node.step &&
            step.node.step.mapConfig && (
            <OutputField label="Function" value={step.node.step.mapConfig} />
          )}
          {stepData.payload && (
            <OutputField label="Input" value={stepData.payload} />
          )}
          {stepData.output && (
            <OutputField label="Output" value={stepData.output} />
          )}
          {stepData.error && (
            <OutputField label="Error" value={stepData.error} />
          )}
        </CardContent>
      )}
    </Card>
  );
}

function InstanceDetailTab() {
  const { workflowName = "", instanceId = "" } = useParams();
  const { data } = useWorkflowStatus(workflowName, instanceId);
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
  const allSteps = flattenStepGraph(stepGraph);

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
      <div className="max-w-2xl mx-auto py-8">
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
                  className="text-muted-foreground ml-4"
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
        <h2 className="text-lg font-semibold mb-2">Steps</h2>
        <div className="space-y-4">
          {allSteps.length > 0
            ? (
              allSteps.map((step, i) => {
                const hasRun = !!contextMap[step.id];
                const isSkipped = isWorkflowDone && !hasRun;
                return (
                  <StepCard
                    key={step.id}
                    step={{ ...step, data: contextMap[step.id] }}
                    workflowStatus={status}
                    isPreview={!contextMap[step.id] && !isSkipped}
                    isCurrent={i === lastRunIdx + 1 && !contextMap[step.id] &&
                      !isSkipped}
                    isSkipped={isSkipped}
                  />
                );
              })
            )
            : <div className="text-muted-foreground">No steps found.</div>}
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
  const { workflowName = "" } = useParams();
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
            },
          ]}
        />
      }
    />
  );
}

export default WorkflowDetailPage;
