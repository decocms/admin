import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MCPConnection } from "@/storage/types";
import { fetcher } from "@/tools/client";
import { KEYS } from "@/web/lib/query-keys";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { useCurrentOrganization } from "@/web/hooks/use-current-organization";
import { useOrganizationSettings } from "@/web/hooks/use-organization-settings";
import { authClient } from "@/web/lib/auth-client";

export function useModelsBindingState() {
  const { locator } = useProjectContext();
  const { organization, isLoading: orgLoading, error: orgError } =
    useCurrentOrganization();
  const organizationId = organization?.id;

  const settingsQuery = useOrganizationSettings(organizationId);

  const connectionsQuery = useQuery({
    queryKey: KEYS.connectionsByBinding(locator, "MODELS"),
    queryFn: async () => {
      return (await fetcher.CONNECTION_LIST({
        binding: "MODELS",
      })) as { connections: MCPConnection[] };
    },
    enabled: Boolean(locator),
    staleTime: 30_000,
  });

  const connection = useMemo(() => {
    if (!connectionsQuery.data?.connections || !settingsQuery.data) {
      return undefined;
    }

    const connectionId = settingsQuery.data.modelsBindingConnectionId;
    if (!connectionId) {
      return undefined;
    }

    return connectionsQuery.data.connections.find(
      (item) => item.id === connectionId,
    );
  }, [connectionsQuery.data, settingsQuery.data]);

  const [isOrgActive, setIsOrgActive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function ensureActiveOrg() {
      if (!organization?.slug) {
        setIsOrgActive(false);
        return;
      }

      setIsOrgActive(false);
      try {
        await authClient.organization.setActive({
          organizationSlug: organization.slug,
        });
      } catch (error) {
        console.error("Failed to ensure active organization", error);
      } finally {
        if (!cancelled) {
          setIsOrgActive(true);
        }
      }
    }

    void ensureActiveOrg();

    return () => {
      cancelled = true;
    };
  }, [organization?.slug]);

  const isReady = Boolean(connection) && isOrgActive;
  const isLoading =
    orgLoading ||
    settingsQuery.isLoading ||
    connectionsQuery.isLoading ||
    (!isOrgActive && Boolean(organization?.slug));
  const error =
    orgError ?? settingsQuery.error ?? connectionsQuery.error;

  return {
    organization,
    connection,
    isReady,
    isLoading,
    isOrgActive,
    error,
  };
}

