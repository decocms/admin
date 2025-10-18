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
