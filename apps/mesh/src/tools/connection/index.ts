/**
 * Connection Management Tools
 *
 * Export all connection-related tools with collection binding compliance.
 */

// Collection-compliant CRUD tools
export { COLLECTION_CONNECTIONS_CREATE } from "./create";
export { COLLECTION_CONNECTIONS_LIST } from "./list";
export { COLLECTION_CONNECTIONS_GET } from "./get";
export { COLLECTION_CONNECTIONS_UPDATE } from "./update";
export { COLLECTION_CONNECTIONS_DELETE } from "./delete";

// Connection test tool
export { COLLECTION_CONNECTIONS_TEST } from "./test";

// Schema exports
export { ConnectionEntitySchema, type ConnectionEntity } from "./schema";

// Utility exports
export { fetchToolsFromMCP } from "./fetch-tools";
