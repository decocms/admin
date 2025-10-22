import { Badge } from "@deco/ui/components/badge.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { getStatusBadgeVariant } from "./utils.ts";
import { useWorkflowStepData } from "../../stores/workflows/hooks.ts";
import { useWorkflowRunQuery } from "./workflow-run-detail.tsx";
import { WorkflowStepInput } from "../workflow-builder/steps.tsx";
import { JsonViewer } from "../chat/json-viewer.tsx";
import ViewDetail from "../views/view-detail.tsx";
import { EMPTY_VIEWS } from "../../stores/workflows/hooks.ts";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { useViewByUriV2 } from "@deco/sdk";

function deepParse(value: unknown, depth = 0): unknown {
  if (typeof value !== "string") {
    return value;
  }

  // Try to parse the string as JSON
  try {
    if (depth > 8) return value;
    const parsed = JSON.parse(value);
    return deepParse(parsed, depth + 1);
  } catch {
    // If parsing fails, check if it looks like truncated JSON
    const trimmed = value.trim();
    const withoutTruncation = trimmed.replace(/\s*\[truncated output]$/i, "");
    if (withoutTruncation.startsWith("{") && !withoutTruncation.endsWith("}")) {
      // Truncated JSON object - try to fix it
      try {
        let fixed = withoutTruncation;
        const quoteCount = (fixed.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          fixed += '"';
        }
        // Add closing brace
        fixed += "}";
        const parsed = JSON.parse(fixed);
        return parsed;
      } catch {
        // If fix didn't work, return as string
        return value;
      }
    }
    if (withoutTruncation.startsWith("[") && !withoutTruncation.endsWith("]")) {
      try {
        const fixed = withoutTruncation;
        const parsed = JSON.parse(fixed + "]");
        return parsed;
      } catch {
        return value;
      }
    }
    // Not truncated JSON or couldn't fix, return as string
    return value;
  }
}

const StepError = memo(function StepError({ error }: { error: unknown }) {
  if (!error) return null;

  const errorObj = error as { name?: string; message?: string };

  return (
    <div className="text-xs bg-destructive/10 text-destructive rounded p-2">
      <div className="font-semibold">{String(errorObj.name || "Error")}</div>
      <div className="mt-1">
        {String(errorObj.message || "An error occurred")}
      </div>
    </div>
  );
});

/**
 * Derives the step status from execution properties (works for both runtime and definition steps)
 */
function deriveStepStatus(execution: {
  success?: boolean | null;
  error?: { message?: string; name?: string } | null;
  start?: string | null;
  end?: string | null;
}): string | undefined {
  if (
    !execution.success &&
    !execution.error &&
    !execution.start &&
    !execution.end
  )
    return;
  // If step has error, it failed
  if (execution.error) return "failed";

  // If step has ended successfully
  if (execution.end && execution.success === true) return "completed";

  // If step has ended but not successfully
  if (execution.end && execution.success === false) return "failed";

  // If step has started but not ended, it's running
  if (execution.start && !execution.end) return "running";

  // Otherwise, it's pending
  return "pending";
}
interface WorkflowStepCardProps {
  stepName: string;
  type: "definition" | "runtime";
}

// Sub-components using composition pattern
const StepIcon = memo(function StepIcon() {
  return (
    <div className="shrink-0 mt-0.5">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
        <Icon name="bolt" size={18} />
      </div>
    </div>
  );
});

interface StepTitleProps {
  stepName: string;
  description?: string;
}

const StepTitle = memo(function StepTitle({
  stepName,
  description,
}: StepTitleProps) {
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <span className="font-medium text-base truncate">{String(stepName)}</span>
      {description && (
        <span className="text-sm text-muted-foreground">{description}</span>
      )}
    </div>
  );
});

interface StepDurationProps {
  startTime?: string | null;
  endTime?: string | null;
  status?: string;
}

function formatDuration(milliseconds: number): string {
  const ms = milliseconds % 1000;
  const totalSeconds = Math.floor(milliseconds / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}.${ms.toString().padStart(3, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}.${ms.toString().padStart(3, "0")}s`;
  }
  return `${seconds}.${ms.toString().padStart(3, "0")}s`;
}

const StepDuration = memo(function StepDuration({
  startTime,
  endTime,
  status,
}: StepDurationProps) {
  const shouldSubscribe = status === "running" && startTime && !endTime;

  const timeRef = useRef(Date.now());

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!shouldSubscribe) return () => {};

      const interval = setInterval(() => {
        timeRef.current = Date.now();
        callback();
      }, 50);

      return () => clearInterval(interval);
    },
    [shouldSubscribe],
  );

  const getSnapshot = useCallback(() => {
    return shouldSubscribe ? timeRef.current : 0;
  }, [shouldSubscribe]);

  const currentTime = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot, // Server snapshot (same as client for time)
  );

  if (!startTime) return null;

  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : currentTime;
  const duration = Math.max(0, end - start);

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon name="schedule" size={14} />
      <span className="font-mono text-xs">{formatDuration(duration)}</span>
    </div>
  );
});

interface StepTimeInfoProps {
  startTime?: string | null;
  endTime?: string | null;
  status?: string;
}

const StepTimeInfo = memo(function StepTimeInfo({
  startTime,
  endTime,
  status,
}: StepTimeInfoProps) {
  if (!startTime) return null;

  return (
    <div className="flex items-center gap-4 text-xs mt-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon name="play_arrow" size={14} />
        <span className="font-mono uppercase">
          {new Date(startTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      {endTime && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon name="check" size={14} />
          <span className="font-mono uppercase">
            {new Date(endTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      )}

      <StepDuration startTime={startTime} endTime={endTime} status={status} />
    </div>
  );
});

interface StepStatusBadgeProps {
  status: string;
}

const StepStatusBadge = memo(function StepStatusBadge({
  status,
}: StepStatusBadgeProps) {
  return (
    <Badge
      variant={getStatusBadgeVariant(status)}
      className="capitalize text-xs shrink-0"
    >
      {status}
    </Badge>
  );
});

interface StepHeaderProps {
  stepName: string;
  description?: string;
  status?: string;
  startTime?: string | null;
  endTime?: string | null;
}

const StepHeader = memo(function StepHeader({
  stepName,
  description,
  status,
  startTime,
  endTime,
}: StepHeaderProps) {
  const isFailed = status === "failed";

  return (
    <div className={`p-4 space-y-2 ${isFailed ? "text-destructive" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <StepIcon />
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <StepTitle stepName={stepName} description={description} />
            <StepTimeInfo
              startTime={startTime}
              endTime={endTime}
              status={status}
            />
          </div>
        </div>
        {status && <StepStatusBadge status={status} />}
      </div>
    </div>
  );
});

interface ViewDialogTriggerProps {
  resourceUri: string;
}

function ViewDialogTrigger({ resourceUri }: ViewDialogTriggerProps) {
  const { data: resource, isLoading, error } = useViewByUriV2(resourceUri);
  const viewData = resource?.data;

  // Use view name, fallback to extracting from URI
  const viewName = useMemo(() => {
    if (viewData?.name) return viewData.name;

    // Extract name from URI as fallback: rsc://integration-id/resource-type/view-name
    try {
      const parts = resourceUri.replace("rsc://", "").split("/");
      const lastPart = parts[parts.length - 1];
      // Clean up the name: replace dashes with spaces, remove timestamp suffix
      return lastPart
        .replace(/-\d{4}-\d{2}-\d{2}T[\d-]+Z$/, "") // Remove timestamp
        .replace(/^Untitled$/, "Untitled View")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()); // Capitalize words
    } catch {
      return "View";
    }
  }, [viewData?.name, resourceUri]);

  if (isLoading) {
    return (
      <Badge variant="outline" className="cursor-wait">
        <Icon name="hourglass_empty" size={12} className="mr-1 animate-pulse" />
        Loading...
      </Badge>
    );
  }

  // Show view even if there's an error, just with fallback name
  const displayName = viewName || "View";
  const hasError = !!error || !viewData;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            hasError
              ? "border border-input bg-background hover:bg-muted"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          <Icon
            name={hasError ? "warning" : "visibility"}
            size={12}
            className="mr-1"
          />
          {displayName}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl w-[95vw] h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Icon name="view_list" size={20} className="text-primary" />
            {displayName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Interactive view preview
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-muted/30">
          <ViewDetail resourceUri={resourceUri} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface StepOutputProps {
  output: unknown;
  views?: readonly string[];
}

function StepOutput({ output, views = EMPTY_VIEWS }: StepOutputProps) {
  const [displayMode, setDisplayMode] = useState<"view" | "json">("view");

  if (output === undefined || output === null) return null;

  const parsedOutput = useMemo(() => deepParse(output), [output]);
  const hasViews = views.length > 0;

  return (
    <div className="space-y-3 min-w-0 w-full">
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm text-muted-foreground uppercase">
          Output
        </p>
        {hasViews && (
          <div className="flex gap-1 border rounded-md p-0.5">
            <Button
              variant={displayMode === "view" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setDisplayMode("view")}
              className="h-7 px-2 text-xs"
            >
              <Icon name="view_list" size={14} className="mr-1" />
              Views
            </Button>
            <Button
              variant={displayMode === "json" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setDisplayMode("json")}
              className="h-7 px-2 text-xs"
            >
              <Icon name="code" size={14} className="mr-1" />
              JSON
            </Button>
          </div>
        )}
      </div>

      {hasViews && displayMode === "view" ? (
        <div className="flex flex-wrap gap-2">
          {views.map((view) => (
            <ViewDialogTrigger key={view} resourceUri={view} />
          ))}
        </div>
      ) : (
        <JsonViewer data={parsedOutput} maxHeight="400px" defaultView="tree" />
      )}
    </div>
  );
}

interface StepAttemptsProps {
  attempts: Array<{
    success?: boolean | null;
    error?: { message?: string; name?: string } | null;
    start?: string | null;
    end?: string | null;
  }>;
}

const StepAttempts = memo(function StepAttempts({
  attempts,
}: StepAttemptsProps) {
  if (!attempts || attempts.length <= 1) return null;

  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
        {attempts.length} attempts
      </summary>
      <div className="mt-2 space-y-2 pl-4">
        {attempts.map((attempt, attemptIdx) => (
          <div key={attemptIdx} className="border-l-2 pl-2 py-1">
            <div className="flex items-center gap-2">
              <span>Attempt {attemptIdx + 1}</span>
              {attempt.success ? (
                <Icon name="check_circle" size={12} className="text-success" />
              ) : (
                <Icon name="error" size={12} className="text-destructive" />
              )}
            </div>
            {attempt.error && (
              <div className="text-destructive mt-1">
                {String(attempt.error.message || "Error")}
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
});

interface StepContentProps {
  error?: { name?: string; message?: string } | null;
  output?: unknown;
  attempts?: Array<{
    success?: boolean | null;
    error?: { message?: string; name?: string } | null;
    start?: string | null;
    end?: string | null;
  }>;
  views?: readonly string[];
}

const StepContent = memo(function StepContent({
  error,
  output,
  attempts,
  views,
}: StepContentProps) {
  const hasContent =
    error ||
    (output !== undefined && output !== null) ||
    (attempts && attempts.length > 1);

  if (!hasContent) return null;

  return (
    <div className="bg-background rounded-xl p-3 space-y-3">
      <StepError error={error} />
      <StepOutput output={output} views={views} />
      <StepAttempts attempts={attempts || []} />
    </div>
  );
});

export const WorkflowStepCard = memo(
  function WorkflowStepCard({ stepName, type }: WorkflowStepCardProps) {
    const stepData = useWorkflowStepData(stepName);
    const runData = useWorkflowRunQuery(type === "runtime");
    const isInteractive = type === "definition";

    const runtimeStep = useMemo(() => {
      if (type === "runtime") {
        return runData?.data?.data?.workflowStatus?.steps?.find(
          (step) => step.name === stepName,
        );
      }
      return undefined;
    }, [runData?.data?.data?.workflowStatus?.steps, type, stepName]);

    const execution = useMemo<
      | {
          start?: string | null;
          end?: string | null;
          error?: { name?: string; message?: string } | null;
          success?: boolean;
        }
      | undefined
    >(() => {
      if (type === "definition" && stepData.execution) {
        return stepData.execution;
      }
      if (type === "runtime" && runtimeStep) {
        return {
          start: runtimeStep.start,
          end: runtimeStep.end,
          error: runtimeStep.error,
          success: runtimeStep.success,
        };
      }
      return undefined;
    }, [type, stepData.execution, runtimeStep]);

    const output = useMemo(() => {
      if (type === "definition") {
        return stepData.output;
      }
      return runtimeStep?.output;
    }, [stepData.output, runtimeStep, type]);

    const status = useMemo(() => {
      if (execution) {
        return deriveStepStatus(execution);
      }
      return undefined;
    }, [execution]);

    return (
      <div className={`rounded-xl p-0.5 bg-muted`}>
        <StepHeader
          stepName={stepName}
          status={status}
          startTime={execution ? execution.start : undefined}
          endTime={execution ? execution.end : undefined}
        />
        {isInteractive && <WorkflowStepInput stepName={stepName} />}
        <StepContent
          output={output}
          views={stepData.views}
          error={execution ? execution.error : undefined}
          attempts={runtimeStep?.attempts}
        />
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.stepName === nextProps.stepName &&
    prevProps.type === nextProps.type,
);
