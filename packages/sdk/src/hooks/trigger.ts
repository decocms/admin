import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  createTrigger,
  CreateTriggerInput,
  deleteTrigger,
  listAllTriggers,
  listRuns,
  type ListRunsResult,
  listTriggers,
  type ListTriggersResult,
} from "../crud/trigger.ts";
import { useSDK } from "./store.tsx";

export function useListTriggersByAgentId(
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

export function useListTriggers() {
  const { workspace } = useSDK();
  return useQuery({
    queryKey: ["triggers"],
    queryFn: () => listAllTriggers(workspace),
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

export function useCreateTrigger(agentId: string) {
  const { workspace } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (trigger: CreateTriggerInput) =>
      createTrigger(workspace, agentId, trigger),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["triggers", agentId] });
    },
  });
}

export function useDeleteTrigger(agentId: string) {
  const { workspace } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (triggerId: string) =>
      deleteTrigger(workspace, agentId, triggerId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["triggers"] });
      client.invalidateQueries({ queryKey: ["triggers", agentId] });
    },
  });
}
