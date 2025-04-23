import { useQuery } from "@tanstack/react-query";
import { listActions } from "../crud/action.ts";
import { useSDK } from "./store.tsx";

export function useListActions(agentId: string) {
  const { context } = useSDK();
  return useQuery({
    queryKey: ["actions", agentId],
    queryFn: () => listActions(context, agentId),
  });
}
