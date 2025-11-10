import { KEYS, MCPClient, useSDK } from "@deco/sdk";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch unlisted marketplace apps (admin only)
 */
export function useUnlistedApps() {
  const { locator } = useSDK();

  return useQuery({
    queryKey: KEYS.UNLISTED_APPS(),
    queryFn: async () => {
      if (!locator) {
        throw new Error("No locator available");
      }

      try {
        const client = MCPClient.forLocator(locator);
        const result = await client.MARKETPLACE_APPS_LIST_UNLISTED_ADMIN({});
        return result.apps;
      } catch {
        throw new Error("Failed to fetch unlisted apps");
      }
    },
    enabled: !!locator,
    // Don't retry on error since this is admin-only
    retry: false,
  });
}
