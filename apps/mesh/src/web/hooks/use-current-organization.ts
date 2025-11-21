import { useMemo } from "react";
import { authClient } from "@/web/lib/auth-client";
import { useProjectContext } from "@/web/providers/project-context-provider";

export function useCurrentOrganization() {
  const { org } = useProjectContext();
  const {
    data: organizations,
    isPending,
    error,
  } = authClient.useListOrganizations();

  const organization = useMemo(
    () => organizations?.find((item) => item.slug === org),
    [organizations, org],
  );

  return {
    organization,
    isLoading: isPending,
    error,
  };
}
