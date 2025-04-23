import { useQuery } from "@tanstack/react-query";
import { listActions } from "../crud/action.ts";
import { useSDK } from "./store.tsx";

export function useListActions(agentId: string) {
  const { workspace } = useSDK();
  return useQuery({
    queryKey: ["actions", agentId],
    queryFn: () => listActions(workspace, agentId),
  });
}
