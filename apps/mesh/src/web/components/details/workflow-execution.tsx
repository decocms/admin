import { Spinner } from "@deco/ui/components/spinner.js";
import {
  WorkflowExecution,
  WorkflowExecutionStepResult,
  WorkflowExecutionStreamChunk,
} from "@decocms/bindings/workflow";
import { ViewLayout, ViewTabs } from "./layout";
import { Button } from "@deco/ui/components/button.js";
import { ExecutionResult } from "./tool";
import { Badge } from "@deco/ui/components/badge.js";
import { useStreamToolCall } from "@/web/hooks/use-stream-tool-call";
import { useMemo } from "react";
import { useWorkflowBindingConnection } from "@/web/hooks/workflows/use-workflow-binding-connection";

export interface WorkflowExecutionDetailsViewProps {
  itemId: string;
  onBack: () => void;
  onUpdate: (updates: Record<string, unknown>) => Promise<void>;
}

/** Extended execution type with step results from streaming */
type WorkflowExecutionWithStepResults = WorkflowExecution & {
  step_results?: WorkflowExecutionStepResult[];
  stream_chunks?: WorkflowExecutionStreamChunk[];
};

/** Response shape from the streaming tool */
interface StreamResponse {
  item: WorkflowExecutionWithStepResults | null;
  error?: string;
}

export function useStreamWorkflowExecution(
  executionId?: string,
  options: {
    onComplete?: () => void;
    onData?: (data: {
      item: {
        stream_chunks?: WorkflowExecutionStreamChunk[];
        step_results?: WorkflowExecutionStepResult[];
      } | null;
    }) => void;
    enabled?: boolean;
  } = {
    enabled: true,
  },
) {
  const { id: connectionId } = useWorkflowBindingConnection();

  const toolInputParams = useMemo(() => ({ id: executionId! }), [executionId]);

  console.log("toolInputParams", toolInputParams);
  console.log("enabled", options?.enabled && !!executionId);

  return useStreamToolCall<{ id: string }, StreamResponse>({
    connectionId,
    toolName: "STREAM_WORKFLOW_EXECUTION_GET",
    toolInputParams,
    enabled: options?.enabled && !!executionId,
    onData: (data: {
      item: {
        stream_chunks?: WorkflowExecutionStreamChunk[];
        step_results?: WorkflowExecutionStepResult[];
      } | null;
    }) => {
      console.log("data", data);
      options?.onData?.(data);
    },
    onComplete: () => {
      console.log("onComplete");
      options?.onComplete?.();
    },
  });
}

export function WorkflowExecutionDetailsView({
  itemId,
  onBack,
}: WorkflowExecutionDetailsViewProps) {
  const { data, isLoading, error } = useStreamWorkflowExecution(itemId);
  console.log("dataMain", data);

  const execution = useMemo(() => data?.item, [data]);
  const stepResults = useMemo(() => execution?.step_results ?? [], [execution]);
  const streamingTextByStep = useMemo(() => {
    const chunks = execution?.stream_chunks ?? [];
    const textByStep: Record<string, string> = {};

    for (const chunk of chunks) {
      if (
        chunk.chunk_data &&
        typeof chunk.chunk_data === "object" &&
        "type" in chunk.chunk_data &&
        chunk.chunk_data.type === "text-delta" &&
        "delta" in chunk.chunk_data &&
        chunk.chunk_data.delta
      ) {
        const stepId = chunk.step_id;
        textByStep[stepId] =
          (textByStep[stepId] ?? "") + chunk.chunk_data.delta;
      }
    }

    return textByStep;
  }, [execution?.stream_chunks]);
  const input = useMemo(() => {
    return Object.keys(execution?.input ?? {}).length > 0
      ? (execution?.input ?? null)
      : null;
  }, [execution]);

  // Show loading state while streaming hasn't received first data
  if (!execution && isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Show error state
  if (error || data?.error) {
    return (
      <ViewLayout onBack={onBack}>
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-destructive">
            <p className="text-lg font-medium">Error loading execution</p>
            <p className="text-sm text-muted-foreground">
              {error?.message || data?.error}
            </p>
          </div>
        </div>
      </ViewLayout>
    );
  }

  // Show not found state
  if (!execution) {
    return (
      <ViewLayout onBack={onBack}>
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-lg">Execution not found</p>
          </div>
        </div>
      </ViewLayout>
    );
  }

  return (
    <ViewLayout onBack={onBack}>
      <ViewTabs>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 bg-muted text-foreground font-normal"
        >
          Steps
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-muted-foreground font-normal"
          disabled={true}
        >
          Triggers
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-muted-foreground font-normal"
          disabled={true}
        >
          Advanced
        </Button>
      </ViewTabs>

      {/* Main Content */}
      <div className="p-5">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-medium">{execution.title}</h2>
            <div className="flex items-center gap-2">
              {isLoading && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  Live
                </span>
              )}
              <Badge variant="outline">{execution.status}</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-medium mb-2">Execution Input</h3>
            <ExecutionResult
              executionResult={input}
              placeholder="No execution input found"
            />
            <h3 className="text-lg font-medium mb-2">
              Step Results ({stepResults.length})
            </h3>
            {stepResults.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {isLoading
                  ? "Waiting for step results..."
                  : "No step results found"}
              </div>
            ) : (
              stepResults.map((stepResult) => {
                // Show streaming text if step is in progress, otherwise show output
                const streamingText = streamingTextByStep[stepResult.step_id];
                const showStreaming =
                  !stepResult.completed_at_epoch_ms && streamingText;

                return (
                  <div key={stepResult.id}>
                    {showStreaming ? (
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="text-sm font-medium mb-2">
                          {stepResult.title}
                          <span className="ml-2 text-xs text-muted-foreground animate-pulse">
                            Streaming...
                          </span>
                        </div>
                        <pre className="text-sm whitespace-pre-wrap">
                          {streamingText}
                        </pre>
                      </div>
                    ) : (
                      <ExecutionResult
                        executionResult={stepResult}
                        placeholder="No step results found"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </ViewLayout>
  );
}
