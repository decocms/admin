import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrgThemeDirectly,
  updateOrgTheme,
  type UpdateOrgThemeInput,
} from "../crud/theme.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";
import { Locator } from "../locator.ts";

export function useOrgTheme(orgId?: number) {
  const { locator } = useSDK();
  const enabled = !!orgId && !!locator;

  return useQuery({
    queryKey: ["org-theme", orgId],
    queryFn: () => getOrgThemeDirectly({ locator, orgId: orgId! }),
    enabled,
  });
}

export function useUpdateOrgTheme() {
  const client = useQueryClient();
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (input: UpdateOrgThemeInput) => updateOrgTheme(input),
    onSuccess: (_, variables) => {
      client.invalidateQueries({ queryKey: ["org-theme", variables.orgId] });

      // Also invalidate workspace theme since it depends on org theme
      if (locator) {
        const { org } = Locator.parse(locator);
        client.invalidateQueries({ queryKey: KEYS.TEAM_THEME(org) });
      }
    },
  });
}
