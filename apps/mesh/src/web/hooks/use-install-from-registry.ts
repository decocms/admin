/**
 * Hook to install a MCP from registry by binding type.
 * Provides inline installation without navigation.
 */

import { useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { createToolCaller } from "@/tools/client";
import type { RegistryItem } from "@/web/components/store/registry-items-section";
import type { ConnectionEntity } from "@/tools/connection/schema";
import {
  CONNECTIONS_COLLECTION,
  useConnections,
} from "@/web/hooks/collections/use-connection";
import { useRegistryConnections } from "@/web/hooks/use-binding";
import { useToolCall } from "@/web/hooks/use-tool-call";
import { authClient } from "@/web/lib/auth-client";
import { useProjectContext } from "@/web/providers/project-context-provider";
import {
  extractConnectionData,
  findRegistryItemByBinding,
} from "@/web/utils/extract-connection-data";

interface InstallResult {
  id: string;
  connection: ConnectionEntity;
}

interface UseInstallFromRegistryResult {
  /**
   * Install a MCP by binding type (e.g., "@deco/database").
   * Returns the new connection data if successful, undefined otherwise.
   */
  installByBinding: (bindingType: string) => Promise<InstallResult | undefined>;
  /**
   * Whether an installation is in progress
   */
  isInstalling: boolean;
  /**
   * Whether registry items are still loading
   */
  isLoading: boolean;
  /**
   * Registry items (for debugging/display)
   */
  registryItems: RegistryItem[];
}

/**
 * Hook that provides inline MCP installation from registry.
 * Use this when you want to install a specific MCP without navigating away.
 */
export function useInstallFromRegistry(): UseInstallFromRegistryResult {
  const { org } = useProjectContext();
  const { data: session } = authClient.useSession();
  const [isInstalling, setIsInstalling] = useState(false);

  // Get all connections and filter to registry connections
  const allConnections = useConnections();
  const registryConnections = useRegistryConnections(allConnections);

  // Use first registry connection (could be extended to search all registries)
  const registryId = registryConnections[0]?.id || "";
  const registryConnection = registryConnections[0];

  // Find the LIST tool from the registry connection
  const listToolName = useMemo(() => {
    if (!registryConnection?.tools) return "";
    const listTool = registryConnection.tools.find((tool) =>
      tool.name.endsWith("_LIST"),
    );
    return listTool?.name || "";
  }, [registryConnection?.tools]);

  const toolCaller = useMemo(() => createToolCaller(registryId), [registryId]);

  // Fetch registry items
  const { data: listResults, isLoading } = useToolCall({
    toolCaller,
    toolName: listToolName,
    toolInputParams: {},
    enabled: !!listToolName && !!registryId,
  });

  // Extract items from results
  const registryItems: RegistryItem[] = useMemo(() => {
    if (!listResults) return [];

    // Direct array response
    if (Array.isArray(listResults)) {
      return listResults;
    }

    // Object with nested array
    if (typeof listResults === "object" && listResults !== null) {
      const itemsKey = Object.keys(listResults).find((key) =>
        Array.isArray(listResults[key as keyof typeof listResults]),
      );

      if (itemsKey) {
        return listResults[
          itemsKey as keyof typeof listResults
        ] as RegistryItem[];
      }
    }

    return [];
  }, [listResults]);

  // Installation function
  const installByBinding = useCallback(
    async (bindingType: string): Promise<InstallResult | undefined> => {
      if (!org || !session?.user?.id) {
        toast.error("Not authenticated");
        return undefined;
      }

      // Find the registry item matching the binding type
      const registryItem = findRegistryItemByBinding(
        registryItems,
        bindingType,
      );

      if (!registryItem) {
        toast.error(`MCP not found in registry: ${bindingType}`);
        return undefined;
      }

      // Extract connection data
      const connectionData = extractConnectionData(
        registryItem,
        org,
        session.user.id,
      );

      if (!connectionData.connection_url) {
        toast.error(
          "This MCP cannot be installed: no connection URL available",
        );
        return undefined;
      }

      setIsInstalling(true);
      try {
        const tx = await CONNECTIONS_COLLECTION.insert(connectionData);
        await tx.isPersisted.promise;

        toast.success(`${connectionData.title} installed successfully`);
        // Return full connection data so caller doesn't need to fetch from collection
        return {
          id: connectionData.id,
          connection: connectionData as ConnectionEntity,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Failed to install MCP: ${message}`);
        return undefined;
      } finally {
        setIsInstalling(false);
      }
    },
    [org, session?.user?.id, registryItems],
  );

  return {
    installByBinding,
    isInstalling,
    isLoading,
    registryItems,
  };
}
