import { useCreateIntegration } from "@deco/sdk";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useCallback } from "react";
import { useNavigateWorkspace } from "./use-navigate-workspace.ts";
import {
  AppKeys,
  getConnectionAppKey,
} from "../components/integrations/apps.ts";

/**
 * Creates an empty app and redirects to the app detail page.
 * Use this for creating custom apps, like connecting to a proprietary MCP server.
 */
export const useCreateCustomApp = () => {
  const create = useCreateIntegration();
  const navigateWorkspace = useNavigateWorkspace();

  return useCallback(async () => {
    try {
      const result = await create.mutateAsync({
        name: "Custom integration",
        description: "A custom integration to a MCP server",
        icon: "icon://linked_services",
        connection: {
          type: "HTTP",
          url: "https://example.com/mcp",
        },
      });
      const key = getConnectionAppKey(result);
      navigateWorkspace(`/apps/${AppKeys.build(key)}`);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to create integration",
      );
    }
  }, [create, navigateWorkspace]);
};
