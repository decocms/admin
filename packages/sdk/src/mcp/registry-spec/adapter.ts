/**
 * Adapter: Translates Deco format → MCP Registry Spec
 *
 * This file contains functions that convert Deco backend responses
 * to the official MCP Registry Spec format, enabling an agnostic
 * abstraction layer.
 */

import type { Integration } from "../../models/mcp";
import type { MCPRegistryServer, DecoOriginalData } from "./schema";

export interface DecoMarketplaceIntegration extends Integration {
  provider: string;
  friendlyName?: string;
  verified?: boolean | null;
  appName?: string | null;
  appId?: string | null;
}

/**
 * Extract capabilities based on Deco metadata
 */
function extractCapabilities(
  integration: DecoMarketplaceIntegration
): ("tools" | "resources" | "prompts" | "roots")[] {
  const caps = new Set<"tools" | "resources" | "prompts" | "roots">();

  // Check metadata for capability indicators
  if (integration.metadata) {
    if (integration.metadata.hasTools !== false) caps.add("tools");
    if (integration.metadata.hasResources) caps.add("resources");
    if (integration.metadata.hasPrompts) caps.add("prompts");
    if (integration.metadata.hasRoots) caps.add("roots");
  }

  return Array.from(caps);
}

/**
 * Extract tags from metadata or description
 */
function extractTags(integration: DecoMarketplaceIntegration): string[] {
  const tags = new Set<string>();

  // Add provider as tag
  if (integration.provider) {
    tags.add(integration.provider);
  }

  // Extract from metadata
  if (integration.metadata) {
    if (Array.isArray(integration.metadata.tags)) {
      integration.metadata.tags.forEach((tag: string) => tags.add(tag));
    }
    if (integration.metadata.category) {
      tags.add(integration.metadata.category);
    }
  }

  // Add inferred tags
  if (integration.verified) {
    tags.add("verified");
  }

  return Array.from(tags);
}


/**
 * Main function: Adapts a Deco integration to MCP Registry Server
 *
 * @param decoIntegration - Integration returned by Deco backend
 * @returns Server in MCP Registry Spec format
 */
export function adaptDecoToMCPRegistry(
  decoIntegration: DecoMarketplaceIntegration
): MCPRegistryServer {
  // Validate basic input
  if (!decoIntegration.id || !decoIntegration.name) {
    throw new Error("Integration must have id and name");
  }

  const adaptedServer: MCPRegistryServer = {
    // Identification
    id: decoIntegration.id,
    name: decoIntegration.friendlyName || decoIntegration.name,
    description: decoIntegration.description,

    // Presentation
    icon: decoIntegration.icon,
    homepage: undefined, // Can come from metadata if available
    createdAt: decoIntegration.createdAt || new Date().toISOString(),
    updatedAt: decoIntegration.createdAt || new Date().toISOString(),

    // Author
    author: {
      name: decoIntegration.provider,
    },

    // Status
    verified: decoIntegration.verified ?? false,
    featured: decoIntegration.metadata?.featured ?? false,
    deprecated: decoIntegration.metadata?.deprecated ?? false,

    // Capabilities and tags
    capabilities: extractCapabilities(decoIntegration),
    tags: extractTags(decoIntegration),

    // Original metadata (to preserve Deco information)
    metadata: {
      ...(decoIntegration.metadata || {}),
      decoOriginal: {
        appName: decoIntegration.appName,
        appId: decoIntegration.appId,
        connection: decoIntegration.connection,
        access: decoIntegration.access,
      },
    },
  };

  // Extract homepage from metadata if available
  if (decoIntegration.metadata?.homepage) {
    adaptedServer.homepage = decoIntegration.metadata.homepage;
  }

  return adaptedServer;
}

/**
 * Adapt multiple integrations at once
 */
export function adaptMultipleToMCPRegistry(
  decoIntegrations: DecoMarketplaceIntegration[]
): MCPRegistryServer[] {
  return decoIntegrations.map(adaptDecoToMCPRegistry);
}

/**
 * Reverse: Extract original connection from metadata for internal use
 * Useful when we need to perform operations that require original Deco data
 */
export function extractDecoConnectionFromMetadata(
  server: MCPRegistryServer
): DecoOriginalData | undefined {
  return server.metadata?.decoOriginal as DecoOriginalData | undefined;
}

/**
 * Check if a server originated from Deco
 */
export function isDecoOriginated(server: MCPRegistryServer): boolean {
  return !!server.metadata?.decoOriginal;
}

