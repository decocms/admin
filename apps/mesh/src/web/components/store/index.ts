/**
 * Store Components
 *
 * Main components for the store discovery and item browsing functionality.
 */

// Main discovery component
export { StoreDiscovery } from "./store-discovery";

// UI component (presentational)
export { StoreDiscoveryUI } from "./store-discovery-ui";
export type { StoreDiscoveryUI as StoreDiscoveryUIComponent } from "./store-discovery-ui";

// Item card components
export { RegistryItemCard } from "./registry-item-card";
export { RegistryItemListCard } from "./registry-item-list-card";

// Section components
export { RegistryItemsSection } from "./registry-items-section";
export type { RegistryItem } from "./registry-items-section";

// Legacy components (kept for backwards compatibility)
export { MCPGrid } from "./mcp-grid";
export { MCPCard } from "./mcp-card";
export { MCPToolCard } from "./mcp-tool-card";
export { MCPToolsGrid } from "./mcp-tools-grid";
export { MCPResultsView } from "./mcp-results-view";

