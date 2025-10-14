/**
 * WORKFLOW RUNTIME - All execution logic in one place
 *
 * Stateless engine for client-side workflow execution
 * All types imported from types/workflow.ts (single source of truth)
 *
 * Functions:
 * - generateStep() - AI step generation via GENERATE_STEP
 * - executeStep() - Single step execution via RUN_WORKFLOW_STEP
 * - executeWorkflow() - Sequential workflow execution
 * - discoverTools() - Tool catalog via DISCOVER_WORKSPACE_TOOLS
 */

import { client } from "./rpc";

/**
 * Discover available tools
 */
export async function discoverTools() {
  console.log("📡 [Runtime] Discovering tools");

  const response = await client.DISCOVER_WORKSPACE_TOOLS({
    includeSchemas: false,
  });

  console.log("✅ [Runtime] Tools discovered:", response);

  return response;
}
