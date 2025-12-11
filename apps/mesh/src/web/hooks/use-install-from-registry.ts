/**
 * Hook to install a MCP from registry by binding type.
 * Provides inline installation without navigation.
 */

import { createToolCaller } from "@/tools/client";
import type { ConnectionEntity } from "@/tools/connection/schema";
import type { RegistryItem } from "@/web/components/store/registry-items-section";
import {
  useConnections,
  useConnectionsCollection,
} from "@/web/hooks/collections/use-connection";
import { useRegistryConnections } from "@/web/hooks/use-binding";
import { getCollection, useCollectionList } from "@/web/hooks/use-collections";
import { authClient } from "@/web/lib/auth-client";
import { useProjectContext } from "@/web/providers/project-context-provider";
import {
  extractConnectionData,
  findRegistryItemByBinding,
} from "@/web/utils/extract-connection-data";
import { useState } from "react";
import { toast } from "sonner";

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
   * Registry items (for debugging/display)
   * Note: This hook uses Suspense, so it must be wrapped in a Suspense boundary.
   * Registry items are guaranteed to be available when the hook doesn't suspend.
   */
  registryItems: RegistryItem[];
}

/**
 * Hook that provides inline MCP installation from registry.
 * Use this when you want to install a specific MCP without navigating away.
 *
 * Note: This hook uses Suspense, so it must be wrapped in a Suspense boundary.
 * Components using this hook should handle loading and error states via Suspense/ErrorBoundary.
 */
export function useInstallFromRegistry(): UseInstallFromRegistryResult {
  const { org } = useProjectContext();
  const { data: session } = authClient.useSession();
  const [isInstalling, setIsInstalling] = useState(false);
  const connectionsCollection = useConnectionsCollection();

  // Get all connections and filter to registry connections
  const allConnections = useConnections();
  const registryConnections = useRegistryConnections(allConnections);

  // Use first registry connection (could be extended to search all registries)
  const registryId = registryConnections[0]?.id || "";

  const toolCaller = createToolCaller(registryId);
  const collection = getCollection(registryId, "REGISTRY_APP", toolCaller);
  const registryItems = useCollectionList(collection) as RegistryItem[];

  // Installation function
  const installByBinding = async (
    bindingType: string,
  ): Promise<InstallResult | undefined> => {
    if (!org || !session?.user?.id) {
      toast.error("Not authenticated");
      return undefined;
    }

    // Find the registry item matching the binding type
    const registryItem = findRegistryItemByBinding(registryItems, bindingType);

    if (!registryItem) {
      toast.error(`MCP not found in registry: ${bindingType}`);
      return undefined;
    }

    // Extract connection data
    const connectionData = extractConnectionData(
      registryItem,
      org.id,
      session.user.id,
    );

    if (!connectionData.connection_url) {
      toast.error("This MCP cannot be installed: no connection URL available");
      return undefined;
    }

    setIsInstalling(true);
    try {
      const tx = await connectionsCollection.insert(connectionData);
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
  };

  return {
    installByBinding,
    isInstalling,
    registryItems,
  };
}
