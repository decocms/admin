import { useMemo } from "react";
import { useWorkflowStore } from "./provider";
import {
  MergedStep,
  useWorkflowRunQuery,
} from "../../components/workflow-builder/workflow-display-canvas";
import { WorkflowStep } from "@deco/sdk";

export function useWorkflow() {
  return useWorkflowStore((state) => state.workflow);
}

export function useWorkflowStep(stepName: string) {
  return useWorkflowStore((state) =>
    state.workflow.steps.find((step) => step.def.name === stepName),
  );
}

export function useWorkflowUri() {
  return useWorkflowStore((state) => state.workflowUri);
}

export function useCurrentRunUri() {
  return useWorkflowStore((state) => state.currentRunUri);
}

export function useWorkflowActions() {
  return useWorkflowStore((state) => state.actions);
}

export function useMergedSteps() {
  const runQuery = useWorkflowRunQuery();
  const run = runQuery.data;
  const workflow = useWorkflow();

  const steps = useMemo<MergedStep[]>(() => {
    const runSteps = run?.data.workflowStatus?.steps;
    const definitionSteps = workflow.steps;

    // If no definition steps, return empty or just runtime steps
    if (!definitionSteps || !Array.isArray(definitionSteps)) {
      return (runSteps || []) as MergedStep[];
    }

    // If no run yet, return definition steps without runtime data
    if (!runSteps || runSteps.length === 0) {
      return definitionSteps as MergedStep[];
    }

    // Merge: for each definition step, use runtime data if available
    return definitionSteps.map((defStep: WorkflowStep, idx: number) => {
      const runtimeStep = runSteps[idx];

      // If we have runtime data for this step, merge it with definition
      if (runtimeStep) {
        return {
          ...defStep,
          ...runtimeStep,
          // Keep definition data in 'def' for reference
          def: defStep.def || defStep,
        } as MergedStep;
      }

      // Otherwise, return the definition step (pending)
      return defStep as MergedStep;
    });
  }, [run?.data.workflowStatus?.steps, workflow]);
  return steps;
}

export function useMergedStep(stepName: string) {
  const steps = useMergedSteps();
  const step = steps.find(
    (step) => step.name === stepName || step.def?.name === stepName,
  );
  if (!step) {
    throw new Error(`Step ${stepName} not found`);
  }
  return step;
}

export function useStepOutput(stepName: string) {
  return useWorkflowStore((state) => state.stepOutputs[stepName]);
}
