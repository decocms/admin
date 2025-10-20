import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWorkflowStore } from "./provider";

export function useWorkflowName() {
  return useWorkflowStore((state) => state.workflow.name);
}

export function useWorkflowDescription() {
  return useWorkflowStore((state) => state.workflow.description);
}

export function useWorkflowStepNames() {
  return useWorkflowStore(
    useShallow((state) => state.workflow.steps.map((step) => step.def.name)),
  );
}

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
    (state) =>
      state.workflow.steps.find((step) => step.def.name === stepName)?.def,
  );
}

export function useWorkflowStepOutputs() {
  return useWorkflowStore(useShallow((state) => state.stepOutputs));
}
export function useWorkflowUri() {
  const name = useWorkflowStore((state) => state.workflow.name);
  return `rsc://i:workflows-management/workflow/${name}`;
}

export function useWorkflowActions() {
  return useWorkflowStore(useShallow((state) => state.actions));
}

export function useWorkflowStepExecution(stepName: string) {
  return useWorkflowStore(
    useShallow((state) => state.stepExecutions[stepName]),
  );
}

export function useWorkflowStepData(stepName: string) {
  return useWorkflowStore(
    useShallow((state) => ({
      output: state.stepOutputs[stepName],
      execution: state.stepExecutions[stepName],
      definition: state.workflow.steps.find((s) => s.def.name === stepName)
        ?.def,
    })),
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
