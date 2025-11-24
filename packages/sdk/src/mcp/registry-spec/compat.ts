/**
 * Compatibility: Hybrid types for gradual transition
 *
 * This file provides types that combine MCPRegistryServer with legacy
 * Deco format fields, allowing gradual migration without breaking changes.
 */

import type { Integration } from "../../models/mcp";
import type { MCPRegistryServer, DecoOriginalData } from "./schema";

/**
 * Hybrid type that combines MCPRegistryServer with legacy Deco fields
 * Used for compatibility during transition
 */
export type MarketplaceIntegrationCompat = MCPRegistryServer & {
  // Legacy Deco fields for compatibility
  provider?: string;
  friendlyName?: string;
  verified?: boolean | null;
  appName?: string | null;
  appId?: string | null;
  connection?: Integration["connection"];
  access?: string | null;
};

/**
 * Convert MCPRegistryServer to format compatible with legacy code
 */
export function toDeskCompatibleMarketplaceIntegration(
  server: MCPRegistryServer
): MarketplaceIntegrationCompat {
  const decoOriginal = (server.metadata?.decoOriginal as DecoOriginalData) ?? {};

  return {
    ...server,
    // Legacy fields mapped
    provider: server.author?.name,
    friendlyName: server.name,
    appName: decoOriginal?.appName,
    appId: decoOriginal?.appId,
    connection: decoOriginal?.connection,
    access: decoOriginal?.access,
  };
}

/**
 * Convert multiple servers
 */
export function toDecoCompatibleMarketplaceIntegrations(
  servers: MCPRegistryServer[]
): MarketplaceIntegrationCompat[] {
  return servers.map(toDeskCompatibleMarketplaceIntegration);
}

