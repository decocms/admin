import { useWorkflowStore } from "./provider";

export const useWorkflow = () => {
  const workflow = useWorkflowStore((state) => state.workflow);
  return workflow;
};

export const useWorkflowUri = () => {
  const uri = useWorkflowStore((state) => state.uri);
  return uri;
};

export const useWorkflowActions = () => {
  const actions = useWorkflowStore((state) => state.actions);
  return actions;
};
