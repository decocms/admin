import type { ProjectLocator } from "../locator.ts";

/**
 * Centralized query key factory functions for React Query.
 * These ensure consistent cache key structure across all resource hooks.
 *
 * Key Structure Philosophy:
 * - Always include locator as the first scope identifier
 * - Use specific resource identifiers (uri, name, id) as the second level
 * - Include filter/pagination params for list queries
 * - Maintain hierarchical structure for easy invalidation
 */

/**
 * Query keys for individual resource reads (by URI)
 */
export const resourceKeys = {
  /**
   * Key for a single tool query
   * @example ["tool", locator, "rsc://i:tools-management/tool/my-tool"]
   */
  tool: (locator: ProjectLocator, uri: string) =>
    ["tool", locator, uri] as const,

  /**
   * Key for a single document query
   * @example ["document", locator, "rsc://i:documents-management/document/my-doc"]
   */
  document: (locator: ProjectLocator, uri: string) =>
    ["document", locator, uri] as const,

  /**
   * Key for a single workflow query
   * @example ["workflow-by-uri-v2", locator, "rsc://i:workflows-management/workflow/my-workflow"]
   */
  workflow: (locator: ProjectLocator, uri: string) =>
    ["workflow-by-uri-v2", locator, uri] as const,

  /**
   * Key for a single view query
   * @example ["view", locator, "rsc://i:views-management/view/my-view"]
   */
  view: (locator: ProjectLocator, uri: string) =>
    ["view", locator, uri] as const,
} as const;

/**
 * Query keys for resource list queries (Resources V2 API)
 */
export const resourceListKeys = {
  /**
   * Key for tool list query
   * @example ["resources-v2-list", locator, "i:tools-management", "tool"]
   */
  tools: (locator: ProjectLocator, integrationId: string) =>
    ["resources-v2-list", locator, integrationId, "tool"] as const,

  /**
   * Key for document list query
   * @example ["resources-v2-list", locator, "i:documents-management", "document"]
   */
  documents: (locator: ProjectLocator, integrationId: string) =>
    ["resources-v2-list", locator, integrationId, "document"] as const,

  /**
   * Key for workflow list query
   * @example ["resources-v2-list", locator, "i:workflows-management", "workflow"]
   */
  workflows: (locator: ProjectLocator, integrationId: string) =>
    ["resources-v2-list", locator, integrationId, "workflow"] as const,

  /**
   * Key for view list query
   * @example ["resources-v2-list", locator, "i:views-management", "view"]
   */
  views: (locator: ProjectLocator, integrationId: string) =>
    ["resources-v2-list", locator, integrationId, "view"] as const,
} as const;

/**
 * Query keys for search/filtered document queries
 */
export const documentSearchKeys = {
  /**
   * Key for document search with filters
   * @example ["documents", locator, "search term", 1, 20]
   */
  search: (
    locator: ProjectLocator,
    term?: string,
    page?: number,
    pageSize?: number,
  ) => ["documents", locator, term, page, pageSize] as const,
} as const;

/**
 * Query keys for workflow execution queries
 */
export const workflowExecutionKeys = {
  /**
   * Key for workflow names list
   * @example ["workflow-names", locator]
   */
  names: (locator: ProjectLocator) => ["workflow-names", locator] as const,

  /**
   * Key for workflow runs by workflow name
   * @example ["workflow-runs", locator, "my-workflow", 1, 20]
   */
  runs: (
    locator: ProjectLocator,
    workflowName: string,
    page?: number,
    perPage?: number,
  ) => ["workflow-runs", locator, workflowName, page, perPage] as const,

  /**
   * Key for recent workflow runs across all workflows
   * @example ["recent-workflow-runs", locator, 1, 20]
   */
  recentRuns: (locator: ProjectLocator, page?: number, perPage?: number) =>
    ["recent-workflow-runs", locator, page, perPage] as const,

  /**
   * Key for workflow status query
   * @example ["workflow-status", locator, "my-workflow", "run-123"]
   */
  status: (locator: ProjectLocator, workflowName: string, instanceId: string) =>
    ["workflow-status", locator, workflowName, instanceId] as const,

  /**
   * Key for reading a single workflow run by URI
   * @example ["workflow-run-read", "rsc://i:workflows-management/workflow-run/run-123"]
   */
  read: (runUri: string) => ["workflow-run-read", runUri] as const,
} as const;

/**
 * Query keys for registry/marketplace queries (no locator needed)
 */
export const registryKeys = {
  /**
   * Key for a single registry app
   * @example ["registry-app", "my-app"]
   */
  app: (appName: string) => ["registry-app", appName] as const,

  /**
   * Key for marketplace integrations list
   * @example ["integrations", "marketplace"]
   */
  marketplace: () => ["integrations", "marketplace"] as const,

  /**
   * Key for marketplace app schema
   * @example ["integrations", "marketplace", "my-app", "schema"]
   */
  schema: (appName: string) =>
    ["integrations", "marketplace", appName, "schema"] as const,
} as const;

/**
 * Utility to extract integration ID from a resource URI
 * @example parseIntegrationId("rsc://i:tools-management/tool/my-tool") => "i:tools-management"
 */
export function parseIntegrationId(uri: string): string {
  return uri.split("/")[2];
}
