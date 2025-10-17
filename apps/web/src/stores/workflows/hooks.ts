import { useWorkflowStore } from "./provider";

export const useWorkflow = () => {
  const workflow = useWorkflowStore().getState().workflow;
  return workflow;
};

export const useWorkflowUri = () => {
  const uri = useWorkflowStore().getState().uri;
  return uri;
};

export const useWorkflowActions = () => {
  const actions = useWorkflowStore().getState().actions;
  return actions;
};
