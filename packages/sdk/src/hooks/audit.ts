import { useSuspenseQuery } from "@tanstack/react-query";
import { listThreads, type Options } from "../crud/thread.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export const useAuditEvents = (options: Options = {}) => {
  const { workspace } = useSDK();

  return useSuspenseQuery({
    queryKey: KEYS.AUDITS(workspace, options),
    queryFn: ({ signal }) => listThreads(workspace, options, { signal }),
  });
};
