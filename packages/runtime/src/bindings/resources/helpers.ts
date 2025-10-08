import {
  ResourceUriSchema,
  type CreateInput,
  type CreateOutput,
  type DeleteInput,
  type DeleteOutput,
  type ReadInput,
  type ReadOutput,
  type SearchInput,
  type SearchOutput,
} from "./schemas.ts";

/**
 * Resources 2.0 Helper Functions
 *
 * This module provides helper functions for working with Resources 2.0
 * URI format and validation.
 *
 * Key Features:
 * - URI validation and parsing utilities
 * - URI construction helpers
 * - Type-safe resource URI handling
 */

/**
 * Utility function to validate a resource URI format
 *
 * @param uri - The URI to validate
 * @returns True if the URI is valid, false otherwise
 */
export function validateResourceUri(uri: string): boolean {
  try {
    ResourceUriSchema.parse(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Utility function to parse a resource URI into its components
 *
 * @param uri - The URI to parse
 * @returns Object containing the parsed components or null if invalid
 */
export function parseResourceUri(uri: string): {
  workspace: string;
  project: string;
  resourceId: string;
} | null {
  try {
    const validated = ResourceUriSchema.parse(uri);
    const match = validated.match(/^rsc:\/\/([^\/]+)\/([^\/]+)\/(.+)$/);

    if (!match) {
      return null;
    }

    return {
      workspace: match[1],
      project: match[2],
      resourceId: match[3],
    };
  } catch {
    return null;
  }
}

/**
 * Utility function to construct a resource URI from components
 *
 * @param workspace - The workspace identifier
 * @param project - The project identifier
 * @param resourceId - The resource identifier
 * @returns The constructed resource URI
 */
export function constructResourceUri(
  workspace: string,
  project: string,
  resourceId: string,
): string {
  return `rsc://${workspace}/${project}/${resourceId}`;
}

// Re-export types for convenience
export type {
  CreateInput,
  CreateOutput,
  DeleteInput,
  DeleteOutput,
  ReadInput,
  ReadOutput,
  SearchInput,
  SearchOutput,
};
