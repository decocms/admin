import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrgTheme } from "../crud/theme.ts";
import { KEYS } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";
import { Locator } from "../locator.ts";
import type { Theme } from "@deco/sdk";

export function useUpdateOrgTheme() {
  const client = useQueryClient();
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (theme: Theme) => updateOrgTheme({ locator, theme }),
    onSuccess: () => {
      const { org } = Locator.parse(locator);
      client.invalidateQueries({ queryKey: KEYS.ORG_THEME(org) });
    },
  });
}
