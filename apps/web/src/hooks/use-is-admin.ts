import { MCPClient, useSDK } from "@deco/sdk";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "./use-user.ts";

/**
 * Hook to check if the current user is an admin
 * Admins are users whose email ends with one of the allowed domains
 */
export function useIsAdmin() {
  const user = useUser();
  const { locator } = useSDK();

  return useQuery({
    queryKey: ["is-admin", user?.email],
    queryFn: async () => {
      if (!user?.email || !locator) {
        return false;
      }

      try {
        const client = MCPClient.forLocator(locator);
        const result = await client.ADMIN_CHECK({});
        return result.isAdmin;
      } catch (error) {
        return false;
      }
    },
    enabled: !!user?.email && !!locator,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
