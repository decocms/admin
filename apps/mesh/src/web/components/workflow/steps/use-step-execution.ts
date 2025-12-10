import { useMemo, useCallback } from "react";
import type {
  WorkflowExecutionStepResult,
  WorkflowExecutionStreamChunk,
} from "@decocms/bindings/workflow";
import {
  useTrackingExecutionId,
  useWorkflowSteps,
} from "@/web/stores/workflow";
import { useStreamedWorkflowExecution } from "../../details/workflow-execution";

/**
 * Get step results for a specific step name
 */
export function getStepResults(
  stepName: string,
  allResults: WorkflowExecutionStepResult[] | undefined,
  allChunks?: WorkflowExecutionStreamChunk[],
): WorkflowExecutionStepResult[] {
  if (!allResults) return [];

  if (allChunks) {
    const chunks = allChunks.filter((chunk) => chunk.step_id === stepName);
    const output = chunks.map((chunk) => chunk.chunk_data);

    return [
      {
        step_id: stepName,
        input: {},
        output,
        completed_at_epoch_ms: Date.now(),
        id: stepName,
        title: stepName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        execution_id: stepName,
        created_by: "system",
        updated_by: "system",
      },
    ];
  }

  const pattern = new RegExp(`^${stepName}(\\[\\d+\\])?$`);
  return allResults.filter((result) => pattern.test(result.step_id));
}

/**
 * Hook for all step results in workflow execution
 */
export function useWorkflowExecution() {
  const steps = useWorkflowSteps();
  const trackingExecutionId = useTrackingExecutionId();
  const {
    execution: data,
    isLoading,
    isFetching,
    isFetched,
    refetch,
  } = useStreamedWorkflowExecution(trackingExecutionId);

  const stepResults = useMemo(() => {
    return steps.map((step) => getStepResults(step.name, data?.step_results));
  }, [steps, data?.step_results]);

  const isFinished = useMemo(() => {
    return data?.status === "success" || data?.status === "error";
  }, [data?.status]);

  const hasOutput = useCallback(
    (stepName: string) => {
      const allResults = stepResults.flat();
      // Check for exact match first
      const exact = allResults.find((s) => s.step_id === stepName)?.output;
      if (exact) return exact;
      // Check for loop results (stepName[N] pattern)
      const pattern = new RegExp(`^${stepName}\\[\\d+\\]$`);
      const loopResults = allResults.filter((r) => pattern.test(r.step_id));
      if (loopResults.length > 0) {
        return loopResults.map((r) => r.output);
      }
      return undefined;
    },
    [stepResults],
  );

  /**
   * Get step result for a step name.
   * For loop steps, aggregates all iteration results into a single result.
   */
  const getStepResult = useCallback(
    (stepName: string) => {
      const allResults = stepResults.flat();
      // Check for exact match first
      const exact = allResults.find((r) => r.step_id === stepName);
      if (exact) return exact;

      // Check for loop results (stepName[N] pattern)
      const pattern = new RegExp(`^${stepName}\\[\\d+\\]$`);
      const loopResults = allResults.filter((r) => pattern.test(r.step_id));
      if (loopResults.length === 0) return undefined;

      // Aggregate loop results into a single result
      const hasError = loopResults.some((r) => r.error);
      const allCompleted = loopResults.every((r) => r.completed_at_epoch_ms);
      const firstResult = loopResults[0];
      const lastResult = loopResults[loopResults.length - 1];

      return {
        step_id: stepName,
        input: firstResult?.input,
        output: loopResults.map((r) => r.output),
        error: hasError ? loopResults.find((r) => r.error)?.error : undefined,
        created_at: firstResult?.created_at,
        completed_at_epoch_ms: allCompleted
          ? lastResult?.completed_at_epoch_ms
          : undefined,
      };
    },
    [stepResults],
  );

  return {
    stepResults,
    isLoading,
    isFetching,
    isFetched,
    isFinished,
    hasOutput,
    getStepResult,
    refetch,
    executionData: data,
  };
}

/**
 * Hook for single step result
 */
export function useStepResult(stepName: string) {
  const { getStepResult, isFetching } = useWorkflowExecution();
  const stepResult = useMemo(
    () => getStepResult(stepName),
    [getStepResult, stepName],
  );
  return { stepResult, isFetching };
}

/**
 * Hook for loop iteration count
 * Loop steps produce results with indexed IDs: stepName[0], stepName[1], etc.
 */
export function useLoopIterations(stepName: string): {
  iterationCount: number;
  isLoopRunning: boolean;
} {
  const { stepResults, isFetching } = useWorkflowExecution();

  return useMemo(() => {
    const allResults = stepResults.flat();
    // Match stepName[N] pattern for loop iterations
    const pattern = new RegExp(`^${stepName}\\[(\\d+)\\]$`);
    const loopResults = allResults.filter((r) => pattern.test(r.step_id));

    const completedIterations = loopResults.filter(
      (r) => r.completed_at_epoch_ms || r.error,
    ).length;

    const runningIterations = loopResults.filter(
      (r) => !r.completed_at_epoch_ms && !r.error,
    ).length;

    return {
      iterationCount: completedIterations,
      isLoopRunning: isFetching && runningIterations > 0,
    };
  }, [stepName, stepResults, isFetching]);
}
