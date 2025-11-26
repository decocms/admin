/**
 * Shared types for database introspection implementations
 */

import type { TableMetadata } from "../types";

/**
 * Database introspector interface
 */
export interface DatabaseIntrospector {
  /**
   * Introspect database schema and return table metadata
   */
  introspect(): Promise<TableMetadata[]>;
}
