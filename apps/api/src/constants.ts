/**
 * Application Constants
 *
 * Centralized constants used across the API
 */

// ============================================================================
// MCP Registry Constants
// ============================================================================

/** MCP Registry API base URL for DecoCMS */
export const DECO_MCP_BASE_URL = "https://mcp.decocms.com";

/** Apps to omit from marketplace/discover */
export const REGISTRY_OMITTED_APPS = [
  "9cecc7d6-d114-44b4-96e3-d4d06faf2c2f",
  "4c5aeb03-6b3d-4b58-bb14-4a0d7ecd4d14",
  "f5fe9093-67a6-416c-8fac-b77d3edf52e0",
  "6bc2c3e3-8858-49cd-b603-ca183e4f4f19",
  "f2bd7ca4-61fb-4dff-9753-45e5b8a85693",
  "0696cdb3-e6da-46ea-93af-e6524cabaa75",
  "5bd518f9-21f6-477f-8fbc-927b1a03018b",
  "b0ae29d5-7220-423c-b57b-d0bbe3816120",
  "fc348403-4bb9-4b95-8cda-b73e8beac4fd",
  "1e810c3c-9da2-4e5e-8312-8e54f125d6bf",
];

/** MCP Registry Spec schema URL */
export const MCP_REGISTRY_SCHEMA_URL =
  "https://static.modelcontextprotocol.io/schemas/2025-10-17/server.schema.json";

/** MCP Registry DecoCMS metadata key */
export const MCP_REGISTRY_DECOCMS_KEY = "mcp.mesh";

/** MCP Registry publisher-provided metadata key */
export const MCP_REGISTRY_PUBLISHER_KEY = "mcp.mesh/publisher-provided";

/** MCP Registry server type */
export const MCP_REGISTRY_SERVER_TYPE = "http" as const;

/** MCP Registry icon MIME type */
export const MCP_REGISTRY_ICON_MIME_TYPE = "image/png";

/** MCP Registry default version */
export const MCP_REGISTRY_DEFAULT_VERSION = "1.0.0";
