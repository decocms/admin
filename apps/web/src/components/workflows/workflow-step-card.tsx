import { useIntegrations } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense, lazy, useState } from "react";
import { IntegrationIcon } from "../integrations/common.tsx";
import { getStatusBadgeVariant } from "./utils.ts";

const LazyHighlighter = lazy(() => import("../chat/lazy-highlighter.tsx"));

interface WorkflowStepCardProps {
  step: {
    name?: string;
    type?: string;
    start?: string | null;
    end?: string | null;
    success?: boolean | null;
    output?: unknown;
    error?: { name?: string; message?: string } | null;
    attempts?: Array<{
      start?: string | null;
      end?: string | null;
      success?: boolean | null;
      error?: { name?: string; message?: string } | null;
    }>;
    config?: unknown;
    def?: {
      name?: string;
      description?: string;
      type?: string;
      integration?: string;
    };
  };
  index: number;
  showStatus?: boolean;
}

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

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      globalThis.window.alert("Clipboard API unavailable");
      return;
    }

    const payload = JSON.stringify(data, null, 2);
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

  const jsonString = JSON.stringify(data, null, 2);

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

export function WorkflowStepCard({
  step,
  index,
  showStatus = true,
}: WorkflowStepCardProps) {
  const { data: integrations } = useIntegrations();

  const stepStatus =
    step.success === true
      ? "completed"
      : step.success === false
        ? "failed"
        : step.start && !step.end
          ? "running"
          : "pending";

  // Get name and description - handle both runtime steps and definition steps
  const stepName = step.name || step.def?.name || `Step ${index + 1}`;
  const stepDescription = step.def?.description;
  const stepType = step.type || step.def?.type;

  // Get integration for tool_call steps
  const integrationId =
    step.def && "integration" in step.def ? step.def.integration : undefined;
  const integration = integrations?.find((i) => i.id === integrationId);

  // Check if there's any content to show in the step body
  const hasContent =
    step.error ||
    (step.config !== undefined && step.config !== null) ||
    (step.output !== undefined && step.output !== null) ||
    (step.attempts && step.attempts.length > 1);

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
              {stepType === "tool_call" && integration ? (
                <IntegrationIcon
                  icon={integration.icon}
                  name={integration.name}
                  size="sm"
                />
              ) : stepType === "code" ? (
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <Icon name="code" size={18} />
                </div>
              ) : (
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <Icon name="bolt" size={18} />
                </div>
              )}
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
          {showStatus && (
            <Badge
              variant={getStatusBadgeVariant(stepStatus)}
              className="capitalize text-xs shrink-0"
            >
              {stepStatus}
            </Badge>
          )}
        </div>
      </div>

      {/* Step Content - only show if there's data */}
      {hasContent && (
        <div className="bg-background rounded-xl p-3 space-y-3">
          <StepError error={step.error} />

          {step.config !== undefined && step.config !== null && (
            <JsonViewer data={step.config} title="Config" />
          )}

          {step.output !== undefined && step.output !== null && (
            <JsonViewer data={step.output} title="Output" />
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
