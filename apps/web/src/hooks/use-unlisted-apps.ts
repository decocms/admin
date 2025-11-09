import { MCPClient, useSDK } from "@deco/sdk";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch unlisted marketplace apps (admin only)
 */
export function useUnlistedApps() {
  const { locator } = useSDK();

  return useQuery({
    queryKey: ["unlisted-apps"],
    queryFn: async () => {
      if (!locator) {
        throw new Error("No locator available");
      }

      try {
        const client = MCPClient.forLocator(locator);
        const result = await client.MARKETPLACE_APPS_LIST_UNLISTED_ADMIN({});
        return result.apps;
      } catch (error) {
        console.error("Error fetching unlisted apps:", error);
        throw error;
      }
    },
    enabled: !!locator,
    // Don't retry on error since this is admin-only
    retry: false,
  });
}
