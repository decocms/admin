/**
 * Workflow Data Models
 * Based on plans/00-IMPORTANTE-LEIA-PRIMEIRO.md and plans/02-data-model-and-refs.md
 *
 * ALL TYPES ARE DERIVED FROM RPC RETURN TYPES - NO NEW TYPES CREATED
 */

import { client } from "@/lib/rpc.ts";

/**
 * Reference to data from previous steps or external sources
 * Format: @stepId.path.to.value or @resource:type/id
 */
export type AtRef = `@${string}`;

/**
 * A single step in a workflow
 */
export type WorkflowStep = NonNullable<
  Awaited<ReturnType<typeof client.DECO_RESOURCE_WORKFLOW_READ>>
>["data"]["steps"][number];

/**
 * Workflow resource (full response from READ operation)
 */
export type WorkflowResource = NonNullable<
  Awaited<ReturnType<typeof client.DECO_RESOURCE_WORKFLOW_READ>>
>;

/**
 * Workflow data only (without resource metadata)
 */
export type Workflow = WorkflowResource["data"];

/**
 * Tool dependency structure
 */
export type WorkflowDependency = NonNullable<
  WorkflowStep["dependencies"]
>[number];

/**
 * RUN_WORKFLOW_STEP input parameters
 */
export type RunWorkflowStepInput = Parameters<
  typeof client.RUN_WORKFLOW_STEP
>[0];

/**
 * RUN_WORKFLOW_STEP output/result
 */
export type RunWorkflowStepOutput = Awaited<
  ReturnType<typeof client.RUN_WORKFLOW_STEP>
>;

/**
 * GENERATE_STEP input parameters
 */
export type GenerateStepInput = Parameters<typeof client.GENERATE_STEP>[0];

/**
 * GENERATE_STEP output/result
 */
export type GenerateStepOutput = Awaited<
  ReturnType<typeof client.GENERATE_STEP>
>;

/**
 * Generated step from GENERATE_STEP tool
 */
export type GeneratedStep = GenerateStepOutput["step"];

/**
 * IMPORT_TOOL_AS_STEP input parameters
 */
export type ImportToolAsStepInput = Parameters<
  typeof client.IMPORT_TOOL_AS_STEP
>[0];

/**
 * IMPORT_TOOL_AS_STEP output/result
 */
export type ImportToolAsStepOutput = Awaited<
  ReturnType<typeof client.IMPORT_TOOL_AS_STEP>
>;

/**
 * AUTHORIZE_WORKFLOW input parameters
 */
export type AuthorizeWorkflowInput = Parameters<
  typeof client.AUTHORIZE_WORKFLOW
>[0];

/**
 * AUTHORIZE_WORKFLOW output/result
 */
export type AuthorizeWorkflowOutput = Awaited<
  ReturnType<typeof client.AUTHORIZE_WORKFLOW>
>;

/**
 * Tool used in a workflow step
 * Note: usedTools is not in the official schema but is added by server-side generation
 */
export interface UsedTool {
  toolName: string;
  integrationId: string;
  integrationName: string;
}

/**
 * Result of resolving @refs in input
 */
export interface ResolvedInput {
  resolved: Record<string, unknown>; // Input with @refs replaced by actual values
  errors?: Array<{
    ref: string;
    error: string;
  }>;
}

/**
 * Execution context for a workflow
 */
export interface WorkflowExecutionContext {
  workflow: Workflow;
  stepResults: Map<string, unknown>; // Map of stepId -> result
  globalInput?: Record<string, unknown>;
}
