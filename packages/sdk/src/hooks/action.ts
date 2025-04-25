import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { listActions, listRuns, type ListRunsResult, type ListActionsResult } from "../crud/action.ts";
import { useSDK } from "./store.tsx";

export function useListActions(
  agentId: string,
  options?: Omit<UseQueryOptions<ListActionsResult, Error, ListActionsResult, string[]>, "queryKey" | "queryFn">
) {
  const { workspace } = useSDK();
  return useQuery({
    queryKey: ["actions", agentId],
    queryFn: () => listActions(workspace, agentId),
    ...options,
  });
}

export function useListActionRuns(
  agentId: string, 
  actionId: string,
  options?: Omit<UseQueryOptions<ListRunsResult, Error, ListRunsResult, string[]>, "queryKey" | "queryFn">
) {
  const { workspace } = useSDK();
  return useQuery({
    queryKey: ["action-runs", agentId, actionId],
    queryFn: () => listRuns(workspace, agentId, actionId),
    ...options,
  });
}