import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/tools/client";
import { KEYS } from "@/web/lib/query-keys";

export function useOrganizationSettings(organizationId?: string) {
  return useQuery({
    queryKey: organizationId
      ? KEYS.organizationSettings(organizationId)
      : ["organization-settings", "unknown"],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      return await fetcher.ORGANIZATION_SETTINGS_GET({ organizationId });
    },
    enabled: Boolean(organizationId),
    retry: 1,
  });
}

export function useUpdateOrganizationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { organizationId: string }) => {
      return await fetcher.ORGANIZATION_SETTINGS_UPDATE(input);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: KEYS.organizationSettings(variables.organizationId),
      });
    },
  });
}
