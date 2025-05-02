import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  listTriggers,
  type ListTriggersResult,
  listRuns,
  type ListRunsResult,
} from "../crud/trigger.ts";
import { useSDK } from "./store.tsx";

export function useListTriggers(
  agentId: string,
  options?: Omit<
    UseQueryOptions<ListTriggersResult, Error, ListTriggersResult, string[]>,
    "queryKey" | "queryFn"
  >,
) {
  const { workspace } = useSDK();
  return useQuery({
    queryKey: ["triggers", agentId],
    queryFn: () => listTriggers(workspace, agentId),
    ...options,
  });
}

export function useListTriggerRuns(
  agentId: string,
  triggerId: string,
  options?: Omit<
    UseQueryOptions<ListRunsResult, Error, ListRunsResult, string[]>,
    "queryKey" | "queryFn"
  >,
) {
  const { workspace } = useSDK();
  return useQuery({
    queryKey: ["trigger-runs", agentId, triggerId],
    queryFn: () => listRuns(workspace, agentId, triggerId),
    ...options,
  });
}
