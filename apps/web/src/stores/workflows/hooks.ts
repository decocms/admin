import { useMemo } from "react";
import { useWorkflowStore } from "./provider";

// Stable empty array to prevent reference instability in selectors
export const EMPTY_VIEWS: readonly string[] = [];

// Primitive selectors - use Object.is for exact equality
export function useWorkflowName() {
  return useWorkflowStore((state) => state.workflow.name, Object.is);
}

export function useWorkflowDescription() {
  return useWorkflowStore((state) => state.workflow.description, Object.is);
}

export function useIsDirty() {
  return useWorkflowStore((state) => state.isDirty, Object.is);
}

export function useWorkflowStepCount() {
  return useWorkflowStore((state) => state.workflow.steps.length, Object.is);
}

// Array/Object selectors - use shallow comparison (default)
export function useWorkflowStepNames() {
  return useWorkflowStore((state) =>
    state.workflow.steps.map((step) => step.def.name),
  );
}

export function useWorkflowSteps() {
  return useWorkflowStore((state) => state.workflow.steps);
}

export function useWorkflow() {
  return useWorkflowStore((state) => state.workflow);
}

export function useWorkflowStepOutputs() {
  return useWorkflowStore((state) => state.stepOutputs);
}

export function usePendingServerUpdate() {
  return useWorkflowStore((state) => state.pendingServerUpdate);
}

export function useLastServerVersion() {
  return useWorkflowStore((state) => state.lastServerVersion);
}

// Computed selectors with memoization
export function useWorkflowStepInput(stepName: string) {
  return useWorkflowStore((state) => {
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
  });
}

export function useWorkflowFirstStepInput() {
  return useWorkflowStore((state) => {
    const first = state.workflow.steps[0];
    const name = first?.def.name;
    const persisted = name ? state.stepInputs[name] : undefined;
    return persisted !== undefined ? persisted : first?.input;
  });
}

export function useWorkflowStepOutput(stepName: string) {
  return useWorkflowStore((state) => state.stepOutputs[stepName]);
}

export function useWorkflowStepDefinition(stepName: string) {
  return useWorkflowStore(
    (state) =>
      state.workflow.steps.find((step) => step.def.name === stepName)?.def,
  );
}

export function useStepTools(stepName: string) {
  return useWorkflowStore((state) => {
    const step = state.workflow.steps.find((s) => s.def.name === stepName);
    return step?.def.dependencies?.flatMap(
      (dep) =>
        dep.toolNames?.map((toolName) => ({
          name: toolName,
          integration: { name: dep.integrationId, icon: undefined },
        })) ?? [],
    );
  });
}

export function useWorkflowUri() {
  return useWorkflowStore((state) => state.workflowUri, Object.is);
}

export function useWorkflowStepExecution(stepName: string) {
  return useWorkflowStore((state) => state.stepExecutions[stepName]);
}

// Memoized complex selector
export function useWorkflowStepData(stepName: string) {
  const selector = useMemo(
    () =>
      (state: {
        stepOutputs: Record<string, unknown>;
        stepExecutions: Record<string, unknown>;
        workflow: { steps: Array<{ def: { name: string }; views?: string[] }> };
      }) => ({
        output: state.stepOutputs[stepName],
        views:
          state.workflow.steps.find((s) => s.def.name === stepName)?.views ??
          EMPTY_VIEWS,
        execution: state.stepExecutions[stepName],
        definition: state.workflow.steps.find((s) => s.def.name === stepName)
          ?.def,
      }),
    [stepName],
  );

  return useWorkflowStore(selector);
}

// Helper functions and type guards
function isObjectWithRequiredArray(
  schema: unknown,
): schema is { required: string[] } {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "required" in schema &&
    Array.isArray((schema as { required: unknown }).required) &&
    (schema as { required: unknown[] }).required.every(
      (item) => typeof item === "string",
    )
  );
}

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
    return value.some(hasValidValue);
  }

  // Other values are valid
  return true;
}

export function useIsFirstStep(stepName: string) {
  return useWorkflowStore((state) => {
    const firstStep = state.workflow.steps[0];
    return firstStep?.def.name === stepName;
  }, Object.is);
}

export function useHasFirstStepInput() {
  const firstStepData = useWorkflowStore((state) => {
    const firstStep = state.workflow.steps[0];
    if (!firstStep) return null;

    const stepName = firstStep.def.name;
    return {
      persistedInput: state.stepInputs[stepName],
      defaultInput: firstStep.input,
      inputSchema: firstStep.def.inputSchema,
    };
  });

  return useMemo(() => {
    if (!firstStepData) return false;

    const { persistedInput, defaultInput, inputSchema } = firstStepData;

    // Check if the schema has any required properties
    const hasRequiredProperties =
      isObjectWithRequiredArray(inputSchema) && inputSchema.required.length > 0;

    // If no required properties, empty input is valid
    if (!hasRequiredProperties) {
      return true;
    }

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

// All actions grouped in one hook (actions are stable, but return object needs shallow)
export function useWorkflowActions() {
  return useWorkflowStore((state) => ({
    // Sync actions
    handleExternalUpdate: state.handleExternalUpdate,
    acceptPendingUpdate: state.acceptPendingUpdate,
    dismissPendingUpdate: state.dismissPendingUpdate,
    // Step management actions
    addStep: state.addStep,
    updateStep: state.updateStep,
    removeStep: state.removeStep,
    // Workflow actions
    updateWorkflow: state.updateWorkflow,
    // Step execution actions
    setStepOutput: state.setStepOutput,
    setStepInput: state.setStepInput,
    setStepExecutionStart: state.setStepExecutionStart,
    setStepExecutionEnd: state.setStepExecutionEnd,
    runStep: state.runStep,
  }));
}
