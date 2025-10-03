import {
  getRegistryApp,
  Integration,
  listIntegrations,
  useSDK,
} from "@deco/sdk";
import { useQuery } from "@tanstack/react-query";

export const useOptionsLoader = (type: string) => {
  const { locator } = useSDK();
  const { data, isPending, refetch } = useQuery({
    queryKey: ["optionsLoader", type],
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async () => {
      // Fetch installed integrations from workspace
      const installedIntegrations = await listIntegrations(locator);

      // Try to get registry app information for the type to understand what we're looking for
      const registryApp = await getRegistryApp({ name: type });

      // Filter integrations based on the type
      const matchingIntegrations = installedIntegrations.filter(
        (integration: Integration) => {
          // Match by name (case-insensitive)
          return registryApp.appName === integration.appName;
        },
      );

      // Convert to OptionItem format with icons
      return matchingIntegrations.map((integration: Integration) => ({
        value: integration.id,
        label: integration.name,
        icon: integration.icon,
      }));
    },
  });
  return { data: data ?? [], isPending, refetch: refetch };
};
