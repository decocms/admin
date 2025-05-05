import { useSuspenseQuery } from "@tanstack/react-query";
import type { Options } from "../crud/audit.ts";
import { listAuditEvents } from "../crud/audit.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export const useAuditEvents = (options: Options = {}) => {
  const { workspace } = useSDK();

  return useSuspenseQuery({
    queryKey: KEYS.AUDITS(workspace, options),
    queryFn: ({ signal }) => listAuditEvents(workspace, options, { signal }),
  });
};
