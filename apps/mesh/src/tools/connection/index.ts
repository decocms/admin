/**
 * Connection Management Tools
 *
 * Export all connection-related tools with collection binding compliance.
 */

// New collection-compliant tools
export {
  COLLECTION_CONNECTIONS_CREATE,
  CONNECTION_CREATE,
} from "./create";
export {
  COLLECTION_CONNECTIONS_LIST,
  CONNECTION_LIST,
} from "./list";
export {
  COLLECTION_CONNECTIONS_GET,
  CONNECTION_GET,
} from "./get";
export {
  COLLECTION_CONNECTIONS_UPDATE,
  CONNECTION_UPDATE,
} from "./update";
export {
  COLLECTION_CONNECTIONS_DELETE,
  CONNECTION_DELETE,
} from "./delete";

// Connection test tool (not part of collections)
export { CONNECTION_TEST } from "./test";

// Schema exports
export {
  ConnectionEntitySchema,
  connectionToEntity,
  type ConnectionEntity,
} from "./schema";
