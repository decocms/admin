/**
 * Store Components
 *
 * Components for store discovery and item browsing.
 */

// Main components
export { StoreDiscovery } from "./store-discovery";
export { StoreDiscoveryUI } from "./store-discovery-ui";

// Item components
export { RegistryItemCard, Icon } from "./registry-item-card";
export type {
  MCPRegistryServer,
  MCPRegistryServerIcon,
  MCPRegistryServerMeta,
} from "./registry-item-card";

// Section components
export { RegistryItemsSection } from "./registry-items-section";
export type { RegistryItem } from "./registry-items-section";

// Utilities
export { extractConnectionData } from "./utils";

// Legacy (backwards compatibility)
export { MCPResultsView } from "./mcp-results-view";
