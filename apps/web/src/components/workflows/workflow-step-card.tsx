import { Badge } from "@deco/ui/components/badge.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense, lazy, useMemo, useState } from "react";
import { getStatusBadgeVariant } from "./utils.ts";
import {
  MergedStep,
  StepInput,
} from "../workflow-builder/workflow-display-canvas.tsx";
import { useWorkflowRunQuery } from "../workflow-builder/workflow-display-canvas.tsx";
import { useMergedStep, useStepOutput } from "../../stores/workflows/hooks.ts";

function deepParse(value: unknown, depth = 0): unknown {
  if (typeof value !== "string") {
    return value;
  }

  // Try to parse the string as JSON
  try {
    const parsed = JSON.parse(value);
    // If successful, recursively parse the result in case it's nested
    return deepParse(parsed, depth + 1);
  } catch (_err) {
    // If parsing fails, check if it looks like truncated JSON
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && !trimmed.endsWith("}")) {
      // Truncated JSON object - try to fix it
      try {
        // Close any open strings and objects
        let fixed = trimmed;
        // If ends with [truncated output], remove it
        // Add closing quote if string is open
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
    // Not truncated JSON or couldn't fix, return as string
    return value;
  }
}

const LazyHighlighter = lazy(() => import("../chat/lazy-highlighter.tsx"));

function JsonViewer({
  data,
  title,
  matchHeight = false,
}: {
  data: unknown;
  title: string;
  matchHeight?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const parsedData = useMemo(() => deepParse(data), [data]);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      globalThis.window.alert("Clipboard API unavailable");
      return;
    }

    const payload = JSON.stringify(parsedData, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error("Failed to copy data", error);
    }
  }

  if (data === null || data === undefined) {
    return (
      <div className="space-y-2">
        <p className="font-mono text-sm text-muted-foreground uppercase">
          {title}
        </p>
        <div className="text-xs text-muted-foreground italic p-2">
          No {title.toLowerCase()}
        </div>
      </div>
    );
  }

  const jsonString = JSON.stringify(parsedData, null, 2);

  return (
    <div
      className={`space-y-2 min-w-0 w-full ${matchHeight ? "h-full flex flex-col" : ""}`}
    >
      <p className="font-mono text-sm text-muted-foreground uppercase">
        {title}
      </p>
      <div
        className={`relative bg-muted rounded-xl ${matchHeight ? "min-h-[200px]" : ""} max-h-[300px] overflow-auto w-full ${matchHeight ? "flex-1" : ""}`}
      >
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 bg-background rounded-xl shadow-sm">
          <button
            type="button"
            onClick={handleCopy}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
          >
            <Icon name={copied ? "check" : "content_copy"} size={16} />
          </button>
        </div>
        <div
          className={`overflow-x-auto w-full ${matchHeight ? "h-full" : ""}`}
        >
          <Suspense
            fallback={
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {jsonString}
              </pre>
            }
          >
            <LazyHighlighter
              language="json"
              content={jsonString}
              fillHeight={matchHeight}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function StepError({ error }: { error: unknown }) {
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
}

function getStepStatus(step: MergedStep) {
  const runQuery = useWorkflowRunQuery();
  const run = runQuery.data;
  if (run?.data.status === "completed") return "completed";
  if (step.start && !step.end) return "running";
  if (step.success === true) return "completed";
  if (step.success === false) return "failed";
  if (run?.data.status === "failed") return "failed";

  return "pending";
}
interface WorkflowStepCardProps {
  stepName: string;
  type: "run" | "definition";
  paramsUri?: string;
}

export function WorkflowStepCard({
  stepName,
  type,
  paramsUri,
}: WorkflowStepCardProps) {
  const step = useMergedStep(stepName, paramsUri);
  const stepStatus = getStepStatus(step);
  const stepOutput = useStepOutput(stepName);

  // Get name and description - handle both runtime steps and definition steps
  const stepDescription = step.def?.description;

  // Check if there's any content to show in the step body
  const hasContent =
    step.error ||
    (step.config !== undefined && step.config !== null) ||
    (step.output !== undefined && step.output !== null) ||
    (step.attempts && step.attempts.length > 1) ||
    (stepOutput !== undefined && stepOutput !== null);

  const mergedStepOutput = step.output || stepOutput;

  return (
    <div
      className={`rounded-xl p-0.5 ${stepStatus === "failed" ? "bg-destructive/10" : "bg-muted"}`}
    >
      {/* Step Header */}
      <div
        className={`p-4 space-y-2 ${stepStatus === "failed" ? "text-destructive" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Step Icon */}
            <div className="shrink-0 mt-0.5">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Icon name="bolt" size={18} />
              </div>
            </div>

            {/* Step Title and Description */}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <span className="font-medium text-base truncate">
                {String(stepName)}
              </span>
              {stepDescription && (
                <span className="text-sm text-muted-foreground">
                  {stepDescription}
                </span>
              )}

              {/* Time information */}
              {(step.start || step.end) && (
                <div className="flex items-center gap-4 text-xs mt-1">
                  {step.start && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Icon name="play_arrow" size={14} />
                      <span className="font-mono uppercase">
                        {new Date(step.start).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}

                  {step.end && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Icon name="check" size={14} />
                      <span className="font-mono uppercase">
                        {new Date(step.end).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <Badge
            variant={getStatusBadgeVariant(stepStatus)}
            className="capitalize text-xs shrink-0"
          >
            {stepStatus}
          </Badge>
        </div>
      </div>

      {type === "definition" && <StepInput step={step} />}

      {/* Step Content - only show if there's data */}
      {hasContent && (
        <div className="bg-background rounded-xl p-3 space-y-3">
          <StepError error={step.error} />
          {mergedStepOutput !== undefined && mergedStepOutput !== null && (
            <JsonViewer data={mergedStepOutput} title="Output" />
          )}

          {step.attempts && step.attempts.length > 1 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                {step.attempts.length} attempts
              </summary>
              <div className="mt-2 space-y-2 pl-4">
                {(
                  step.attempts as Array<{
                    success?: boolean;
                    error?: { message?: string };
                  }>
                ).map((attempt, attemptIdx) => (
                  <div key={attemptIdx} className="border-l-2 pl-2 py-1">
                    <div className="flex items-center gap-2">
                      <span>Attempt {attemptIdx + 1}</span>
                      {attempt.success ? (
                        <Icon
                          name="check_circle"
                          size={12}
                          className="text-success"
                        />
                      ) : (
                        <Icon
                          name="error"
                          size={12}
                          className="text-destructive"
                        />
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
          )}
        </div>
      )}
    </div>
  );
}
