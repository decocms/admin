import { useQuery } from "@tanstack/react-query";
import { listThreads, type ThreadFilterOptions } from "../crud/thread.ts";
import { KEYS } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";

export const useAuditEvents = (options: ThreadFilterOptions = {}) => {
  const { locator } = useSDK();

  return useQuery({
    queryKey: KEYS.AUDITS(locator, options),
    queryFn: ({ signal }) => listThreads(locator, options, { signal }),
    staleTime: 0,
    gcTime: 0,
  });
};
