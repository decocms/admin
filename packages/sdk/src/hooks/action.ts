import { useQuery } from "@tanstack/react-query";
import { listActions, listRuns } from "../crud/action.ts";
import { useSDK } from "./store.tsx";

export function useListActions(agentId: string) {
  const { workspace } = useSDK();
  return useQuery({
    queryKey: ["actions", agentId],
    queryFn: () => listActions(workspace, agentId),
  });
}

export function useListActionRuns(agentId: string, actionId: string) {
  const { workspace } = useSDK();
  return useQuery({
    queryKey: ["action-runs", agentId, actionId],
    queryFn: () => listRuns(workspace, agentId, actionId),
  });
}