import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWorkflowStore } from "./provider";

// Primitive selectors - no shallow needed
export function useWorkflowName() {
  return useWorkflowStore((state) => state.workflow.name);
}

export function useWorkflowDescription() {
  return useWorkflowStore((state) => state.workflow.description);
}

export function useIsDirty() {
  return useWorkflowStore((state) => state.isDirty);
}

export function useWorkflowStepCount() {
  return useWorkflowStore((state) => state.workflow.steps.length);
}

// Array/Object selectors - use shallow
export function useWorkflowStepNames() {
  return useWorkflowStore(
    useShallow((state) => state.workflow.steps.map((step) => step.def.name)),
  );
}

export function useWorkflowSteps() {
  return useWorkflowStore(useShallow((state) => state.workflow.steps));
}

export function useWorkflow() {
  return useWorkflowStore(useShallow((state) => state.workflow));
}

export function useWorkflowStepOutputs() {
  return useWorkflowStore(useShallow((state) => state.stepOutputs));
}

export function usePendingServerUpdate() {
  return useWorkflowStore(useShallow((state) => state.pendingServerUpdate));
}

export function useLastServerVersion() {
  return useWorkflowStore(useShallow((state) => state.lastServerVersion));
}

// Computed selectors with memoization
export function useWorkflowStepInput(stepName: string) {
  return useWorkflowStore(
    useShallow((state) => {
      const step = state.workflow.steps.find(
        (step) => step.def.name === stepName,
      );
      const stepInput = state.stepInputs[stepName];
      if (
        stepInput !== undefined &&
        typeof stepInput === "object" &&
        stepInput !== null &&
        Object.keys(stepInput).length > 0
      ) {
        return stepInput;
      }
      return step?.input;
    }),
  );
}

export function useWorkflowFirstStepInput() {
  return useWorkflowStore(
    useShallow((state) => {
      const first = state.workflow.steps[0];
      const name = first?.def.name;
      const persisted = name ? state.stepInputs[name] : undefined;
      return persisted !== undefined ? persisted : first?.input;
    }),
  );
}

export function useWorkflowStepOutput(stepName: string) {
  return useWorkflowStore((state) => state.stepOutputs[stepName]);
}

export function useWorkflowStepDefinition(stepName: string) {
  return useWorkflowStore(
    useShallow(
      (state) =>
        state.workflow.steps.find((step) => step.def.name === stepName)?.def,
    ),
  );
}

export function useWorkflowUri() {
  const name = useWorkflowStore((state) => state.workflow.name);
  return useMemo(() => `rsc://i:workflows-management/workflow/${name}`, [name]);
}

export function useWorkflowStepExecution(stepName: string) {
  return useWorkflowStore(
    useShallow((state) => state.stepExecutions[stepName]),
  );
}

// Memoized complex selector
export function useWorkflowStepData(stepName: string) {
  const selector = useMemo(
    () =>
      (state: {
        stepOutputs: Record<string, unknown>;
        stepExecutions: Record<string, unknown>;
        workflow: { steps: Array<{ def: { name: string } }> };
      }) => ({
        output: state.stepOutputs[stepName],
        execution: state.stepExecutions[stepName],
        definition: state.workflow.steps.find((s) => s.def.name === stepName)
          ?.def,
      }),
    [stepName],
  );

  return useWorkflowStore(useShallow(selector));
}

// Helper functions
function hasValidValue(value: unknown): boolean {
  // References are not valid for first step
  if (typeof value === "string" && value.startsWith("@")) {
    return false;
  }

  // Empty strings are not valid
  if (value === "" || value === null || value === undefined) {
    return false;
  }

  // For objects, check if they have at least one valid property
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.values(value as Record<string, unknown>).some(hasValidValue);
  }

  // For arrays, check if they have at least one valid element
  if (Array.isArray(value)) {
    return value.length > 0 && value.some(hasValidValue);
  }

  // Other values are valid
  return true;
}

export function useIsFirstStep(stepName: string) {
  return useWorkflowStore((state) => {
    const firstStep = state.workflow.steps[0];
    return firstStep?.def.name === stepName;
  });
}

export function useHasFirstStepInput() {
  const firstStepData = useWorkflowStore(
    useShallow((state) => {
      const firstStep = state.workflow.steps[0];
      if (!firstStep) return null;

      const stepName = firstStep.def.name;
      return {
        persistedInput: state.stepInputs[stepName],
        defaultInput: firstStep.input,
      };
    }),
  );

  return useMemo(() => {
    if (!firstStepData) return false;

    const { persistedInput, defaultInput } = firstStepData;

    // Check if there's persisted input with valid values
    if (
      persistedInput !== undefined &&
      typeof persistedInput === "object" &&
      persistedInput !== null
    ) {
      const hasValid = Object.values(
        persistedInput as Record<string, unknown>,
      ).some(hasValidValue);
      if (hasValid) return true;
    }

    // Check if there's default input with valid values
    if (
      defaultInput !== undefined &&
      typeof defaultInput === "object" &&
      defaultInput !== null
    ) {
      const hasValid = Object.values(
        defaultInput as Record<string, unknown>,
      ).some(hasValidValue);
      if (hasValid) return true;
    }

    return false;
  }, [firstStepData]);
}

// All actions grouped in one hook for convenience
export function useWorkflowActions() {
  return useWorkflowStore(
    useShallow((state) => ({
      // Sync actions
      handleExternalUpdate: state.handleExternalUpdate,
      acceptPendingUpdate: state.acceptPendingUpdate,
      dismissPendingUpdate: state.dismissPendingUpdate,
      markClean: state.markClean,
      // Step management actions
      addStep: state.addStep,
      updateStep: state.updateStep,
      removeStep: state.removeStep,
      reorderSteps: state.reorderSteps,
      // Workflow actions
      updateWorkflow: state.updateWorkflow,
      // Step execution actions
      setStepOutput: state.setStepOutput,
      setStepInput: state.setStepInput,
      setStepExecutionStart: state.setStepExecutionStart,
      setStepExecutionEnd: state.setStepExecutionEnd,
    })),
  );
}
