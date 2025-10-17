import { useWorkflowStore } from "./provider";

export function useWorkflow() {
  return useWorkflowStore((state) => state.workflow);
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
