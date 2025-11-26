import type { Integration, MCPConnection } from "@deco/sdk";
import { MCP_METADATA_NAMESPACE_DECO } from "../../constants.ts";

/**
 * Deco-specific metadata namespace structure
 * Stores all Deco integration-specific information
 */
export interface DecoMetadata {
  /** Server lifecycle status */
  status: "active" | "inactive" | "deprecated";

  /** Verified by Deco */
  verified: boolean;

  /** Timestamp when first published */
  publishedAt?: string;

  /** Timestamp when last updated */
  updatedAt?: string;

  /** Integration provider */
  provider?: string;

  /** Connection configuration (Deco-specific) */
  connection?: MCPConnection;

  /** Original name before adaptation */
  originalName?: string;

  /** App ID */
  appId?: string;

  /** Tags/categories */
  tags?: string[];

  /** Banner URL */
  banner?: string;
}

/**
 * Agnostic interface based on MCP Registry Spec
 * Compatible with any registry that implements the official standard
 * https://registry.modelcontextprotocol.io/docs#/schemas
 */
export interface MarketplaceIntegration {
  /** Unique identifier (MCP Spec) */
  id: string;

  /** Technical identifier namespace (MCP Spec) */
  name: string;

  /** Display name / title (MCP Spec) */
  title?: string;

  /** Integration description (MCP Spec) */
  description?: string;

  /** Version (MCP Spec) */
  version?: string;

  /** Icons array (MCP Spec) */
  icons?: Array<{
    src: string;
    mimeType?: string;
    theme?: "light" | "dark";
    sizes?: string[];
  }>;

  /** Repository information (MCP Spec) */
  repository?: {
    url: string;
    source: string;
    subfolder?: string;
  };

  /** Website URL (MCP Spec) */
  websiteUrl?: string;

  /** Deployment packages (MCP Spec) */
  packages?: Record<string, unknown>[];

  /** Registry-managed metadata (MCP Spec) */
  _meta?: {
    [MCP_METADATA_NAMESPACE_DECO]: DecoMetadata;
  };
}

/**
 * Extended MarketplaceIntegration with legacy/compatibility properties
 * Used internally for backward compatibility with existing code
 * New code should use the standard MarketplaceIntegration interface
 */
export interface MarketplaceIntegrationCompat extends MarketplaceIntegration {
  // Legacy/compatibility properties (for internal use)
  /** @deprecated Use _meta["deco/internal"].provider instead */
  provider?: string;

  /** @deprecated Use icons array instead */
  icon?: string;

  /** @deprecated Use _meta["deco/internal"].verified instead */
  verified?: boolean | null;

  /** @deprecated Use _meta["deco/internal"].connection instead */
  connection?: MCPConnection;

  /** @deprecated Use title instead */
  friendlyName?: string;

  /** @deprecated Legacy property */
  appName?: string;
}

/**
 * Deco backend type with extra fields
 * Allows metadata to be null or undefined (Integration may return null)
 */
export type DecoIntegration = Integration & {
  provider?: string;
  friendlyName?: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * UI grouped app representation for marketplace listings
 * Used internally for displaying app lists before adaptation to MCP spec
 */
export interface GroupedApp {
  id: string;
  name: string;
  icon?: string;
  description: string;
  instances: number;
  provider?: string;
  usedBy?: string[];
  verified?: boolean;
  connection?: MCPConnection;
  friendlyName?: string;
  isNative?: boolean;
}

/**
 * Extracts tags from metadata field
 */
function extractTagsFromMetadata(
  metadata?: Record<string, unknown> | null,
): string[] {
  if (!metadata?.tags) return [];
  const tags = metadata.tags;
  return Array.isArray(tags)
    ? tags.filter((t): t is string => typeof t === "string")
    : [];
}

/**
 * Safely extracts banner URL from metadata
 */
function extractBannerFromMetadata(
  metadata?: Record<string, unknown> | null,
): string | undefined {
  if (!metadata?.banner) return undefined;
  const banner = metadata.banner;
  return typeof banner === "string" ? banner : undefined;
}

/**
 * Adapts a Deco backend integration to MCP Registry Spec format
 *
 * Maps Deco fields to MCP spec:
 * - appName → name (technical identifier)
 * - friendlyName → title (display name)
 * - Deco-specific fields → _meta[deco/internal]
 *
 * Preserves all Deco fields without data loss
 */
export function adaptDecoToMarketplace(
  decoIntegration: DecoIntegration,
): MarketplaceIntegration {
  const useFriendlyName = !!decoIntegration.friendlyName;
  // Extract appId from appName (format: @provider/appId)
  const appName = decoIntegration.appName || decoIntegration.name;
  const appNameParts = appName.split("/");
  const appId = appNameParts.pop() || appName;
  // Extract provider from name (@provider/appId format)
  const providerFromName =
    appNameParts.length > 0
      ? appNameParts[0].replace("@", "")
      : decoIntegration.provider;

  const adapted: MarketplaceIntegration = {
    // MCP Spec fields
    id: appId,
    name: appName,
    title: decoIntegration.friendlyName || decoIntegration.name,
    description: decoIntegration.description,
    version: "1.0.0",

    // Icons
    icons: decoIntegration.icon
      ? [
          {
            src: decoIntegration.icon,
            mimeType: "image/png",
            theme: "light" as const,
          },
        ]
      : undefined,

    // Metadata structured by namespace
    _meta: {
      [MCP_METADATA_NAMESPACE_DECO]: {
        status: "active" as const,
        verified: decoIntegration.verified ?? false,
        publishedAt:
          typeof decoIntegration.metadata?.publishedAt === "string"
            ? decoIntegration.metadata.publishedAt
            : undefined,
        updatedAt:
          typeof decoIntegration.metadata?.updatedAt === "string"
            ? decoIntegration.metadata.updatedAt
            : undefined,
        provider: providerFromName,
        connection: decoIntegration.connection,
        originalName: useFriendlyName ? decoIntegration.name : undefined,
        appId: decoIntegration.appName ?? undefined,
        tags: extractTagsFromMetadata(decoIntegration.metadata),
        banner: extractBannerFromMetadata(decoIntegration.metadata),
      },
    },
  };

  return adapted;
}

/**
 * Adapts multiple integrations
 */
export function adaptDecoIntegrationsToMarketplace(
  integrations: DecoIntegration[],
): MarketplaceIntegration[] {
  return integrations.map(adaptDecoToMarketplace);
}

/**
 * Helper functions to access Deco-specific metadata safely
 */
export function getDecoMeta(
  integration?: MarketplaceIntegration,
): DecoMetadata | undefined {
  if (!integration) return undefined;
  return integration._meta?.[MCP_METADATA_NAMESPACE_DECO];
}

/**
 * Get provider from a MarketplaceIntegration (used for AppKey extraction)
 * Extracts provider from name format @provider/appId or from metadata
 */
export function getMarketplaceAppKey(integration: MarketplaceIntegration): {
  appId: string;
  provider: string;
} {
  // Try to extract provider from metadata first
  let provider = getProvider(integration);

  // If not found, try to extract from name (@provider/appId format)
  if (!provider && integration.name) {
    const nameParts = integration.name.split("/");
    if (nameParts.length > 1) {
      provider = nameParts[0].replace("@", "");
    }
  }

  // Fallback to "unknown"
  provider = provider || "unknown";

  return {
    appId: integration.id,
    provider,
  };
}

export function getVerified(integration?: MarketplaceIntegration): boolean {
  return getDecoMeta(integration)?.verified ?? false;
}

export function getStatus(
  integration?: MarketplaceIntegration,
): "active" | "inactive" | "deprecated" {
  return getDecoMeta(integration)?.status ?? "active";
}

export function getConnection(
  integration?: MarketplaceIntegration | Partial<MarketplaceIntegration>,
): MCPConnection | undefined {
  return getDecoMeta(integration as MarketplaceIntegration)?.connection;
}

export function getProvider(
  integration?: MarketplaceIntegration,
): string | undefined {
  return getDecoMeta(integration)?.provider;
}

export function getTags(integration?: MarketplaceIntegration): string[] {
  return getDecoMeta(integration)?.tags ?? [];
}

export function getIconUrl(
  integration?: MarketplaceIntegration | Record<string, unknown>,
): string | undefined {
  if (!integration) return undefined;

  // Try to get icon from icons array (MCP format)
  const icons = (integration as Partial<MarketplaceIntegration>).icons;
  if (icons && icons.length > 0) {
    const icon = icons.find((ico) => ico.theme === "light" || !ico.theme);
    if (icon?.src) return icon.src;
  }

  // Fallback to direct icon field (for compatibility with GroupedApp or legacy format)
  const iconField = (integration as Record<string, unknown>).icon;
  if (typeof iconField === "string") {
    return iconField;
  }

  return undefined;
}

export function getBannerUrl(
  integration?: MarketplaceIntegration,
): string | undefined {
  return getDecoMeta(integration)?.banner;
}

/**
 * Converts a GroupedApp (used for UI listing) to MarketplaceIntegration (MCP Spec)
 * Used primarily for compatibility and data transformation
 *
 * @param groupedApp - GroupedApp object from useGroupedApps
 * @returns MarketplaceIntegration in MCP Registry Spec format
 */
export function groupedAppToMarketplaceIntegration(
  groupedApp: GroupedApp,
): MarketplaceIntegration {
  return {
    id: groupedApp.id,
    name: groupedApp.name,
    title: groupedApp.friendlyName || groupedApp.name,
    description: groupedApp.description || "",
    version: "1.0.0",
    icons: groupedApp.icon
      ? [
          {
            src: groupedApp.icon,
            mimeType: "image/png",
            theme: "light",
          },
        ]
      : undefined,
    _meta: {
      [MCP_METADATA_NAMESPACE_DECO]: {
        status: "active",
        verified: groupedApp.verified ?? false,
        provider: groupedApp.provider,
        connection: groupedApp.connection,
      },
    },
  };
}
