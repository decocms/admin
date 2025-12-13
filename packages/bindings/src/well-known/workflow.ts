/**
 * Workflows Well-Known Binding
 *
 * Defines the interface for workflow providers.
 * Any MCP that implements this binding can expose configurable workflows,
 * executions, step results, and events via collection bindings.
 *
 * This binding uses collection bindings for LIST and GET operations (read-only).
 */

import { z } from "zod";
import { type Binder, bindingClient, type ToolBinder } from "../core/binder";
import {
  BaseCollectionEntitySchema,
  createCollectionBindings,
} from "./collections";

export const ToolCallActionSchema = z.object({
  connectionId: z.string().describe("Integration connection ID"),
  toolName: z.string().describe("Name of the tool to call"),
});
export type ToolCallAction = z.infer<typeof ToolCallActionSchema>;

export const CodeActionSchema = z.object({
  code: z.string().describe("TypeScript code for pure data transformation"),
});
export type CodeAction = z.infer<typeof CodeActionSchema>;
export const SleepActionSchema = z.union([
  z.object({
    sleepMs: z.number().describe("Milliseconds to sleep"),
  }),
  z.object({
    sleepUntil: z.string().describe("ISO date string or @ref to sleep until"),
  }),
]);
export type SleepAction = z.infer<typeof SleepActionSchema>;

export const WaitForSignalActionSchema = z.object({
  signalName: z
    .string()
    .describe("Name of the signal to wait for (must be unique per execution)"),
  timeoutMs: z
    .number()
    .optional()
    .describe("Maximum time to wait in milliseconds (default: no timeout)"),
  description: z
    .string()
    .optional()
    .describe("Human-readable description of what this signal is waiting for"),
});
export type WaitForSignalAction = z.infer<typeof WaitForSignalActionSchema>;

export const StepActionSchema = z.union([
  ToolCallActionSchema.describe(
    "Call an external tool (non-deterministic, checkpointed)",
  ),
  CodeActionSchema.describe(
    "Pure TypeScript data transformation (deterministic, replayable)",
  ),
  SleepActionSchema.describe("Wait for time"),
  WaitForSignalActionSchema.describe("Wait for external signal"),
]);
export type StepAction = z.infer<typeof StepActionSchema>;
/**
 * Loop Config Schema - Run the step in a loop
 */
export const LoopConfigSchema = z.object({
  for: z
    .object({
      items: z
        .string()
        .describe("@ref to array to iterate over, e.g. '@fetchData.items'"),
      as: z
        .string()
        .default("item")
        .describe(
          "Variable name for current item, default 'item' (accessible as @item)",
        ),
    })
    .optional(),
  until: z
    .object({
      path: z
        .string()
        .describe("Path to the output property to check, e.g. '@success'"),
      condition: z
        .enum(["=", "!=", ">", ">=", "<", "<=", "and", "or"])
        .optional(),
      value: z
        .string()
        .describe(
          "Value to compare to. Can be a @ref to any property from this or previous steps output, or a literal value",
        ),
    })
    .optional(),
  while: z
    .object({
      path: z
        .string()
        .describe("Path to the output property to check, e.g. '@success'"),
      condition: z.enum(["=", "!=", ">", ">=", "<", "<=", "and", "or"]),
      value: z
        .string()
        .describe(
          "Value to compare to. Can be a @ref to any property from this or previous steps output, or a literal value",
        ),
    })
    .optional(),
  limit: z
    .number()
    .optional()
    .describe(
      "Maximum number of iterations. If not specified, the loop will run indefinitely until the condition is met or the step is cancelled.",
    ),
  intervalMs: z
    .number()
    .optional()
    .describe(
      "Interval in milliseconds to wait between iterations. If not specified, the loop will run as fast as possible.",
    ),
});
export type LoopConfig = z.infer<typeof LoopConfigSchema>;

/**
 * Step Config Schema - Optional configuration for step execution
 */
export const StepConfigSchema = z.object({
  maxAttempts: z.number().optional().describe("Maximum retry attempts"),
  backoffMs: z.number().optional().describe("Initial backoff in milliseconds"),
  timeoutMs: z.number().optional().describe("Timeout in milliseconds"),
  loop: LoopConfigSchema.optional().describe("Run the step in a loop"),
});
export type StepConfig = z.infer<typeof StepConfigSchema>;

/**
 * Step Schema - Unified schema for all step types
 *
 * Step types:
 * - tool: Call external service via MCP (non-deterministic, checkpointed)
 * - transform: Pure TypeScript data transformation (deterministic, replayable)
 * - sleep: Wait for time
 * - waitForSignal: Block until external signal (human-in-the-loop)
 *
 * Features:
 * - Auto-parallelization: Steps are grouped by @ref dependencies automatically
 * - forEach: Iterate over arrays with sequential/parallel/race/allSettled modes
 * - parallel groups: Explicit step grouping with race/allSettled for special cases
 */
export const StepSchema = z.object({
  name: z.string().min(1).describe("Unique step name within workflow"),
  action: StepActionSchema,
  input: z
    .record(z.unknown())
    .optional()
    .describe(
      "Input object with @ref resolution or default values. Example: { 'user_id': '@input.user_id', 'product_id': '@input.product_id' }",
    ),
  outputSchema: z
    .record(z.unknown())
    .nullish()
    .describe("JsonSchema for the step output"),
  config: StepConfigSchema.optional().describe(
    "Step configuration (retry, forEach, parallel groups)",
  ),
});

export type Step = z.infer<typeof StepSchema>;

/**
 * Workflow Execution Status
 *
 * States:
 * - pending: Created but not started
 * - running: Currently executing
 * - completed: Successfully finished
 * - cancelled: Manually cancelled
 */

const WorkflowExecutionStatusEnum = z
  .enum(["enqueued", "running", "success", "error", "cancelled"])
  .default("enqueued");
export type WorkflowExecutionStatus = z.infer<
  typeof WorkflowExecutionStatusEnum
>;

/**
 * Workflow Execution Schema
 *
 * Includes lock columns and retry tracking.
 */
export const WorkflowExecutionSchema = BaseCollectionEntitySchema.extend({
  workflow_id: z.string(),
  status: WorkflowExecutionStatusEnum,
  input: z.record(z.unknown()).optional(),
  output: z.unknown(),
  completed_at_epoch_ms: z.number().nullish(),
  start_at_epoch_ms: z.number().nullish(),
  timeout_ms: z.number().nullish(),
  deadline_at_epoch_ms: z.number().nullish(),
  error: z.unknown(),
});
export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;

/**
 * Execution Step Result Schema
 *
 * Includes attempt tracking and error history.
 */
export const WorkflowExecutionStepResultSchema =
  BaseCollectionEntitySchema.extend({
    execution_id: z.string(),
    step_id: z.string(),

    input: z.record(z.unknown()).nullish(),
    output: z.unknown().nullish(), // Can be object or array (forEach steps produce arrays)
    error: z.string().nullish(),
    completed_at_epoch_ms: z.number().nullish(),
  });
export type WorkflowExecutionStepResult = z.infer<
  typeof WorkflowExecutionStepResultSchema
>;

export const WorkflowExecutionStreamChunkSchema = z.object({
  step_id: z.string(),
  chunk_data: z.unknown(),
});
export type WorkflowExecutionStreamChunk = z.infer<
  typeof WorkflowExecutionStreamChunkSchema
>;

export const WorkflowExecutionWithStepResultsSchema =
  WorkflowExecutionSchema.extend({
    step_results: z.array(WorkflowExecutionStepResultSchema).optional(),
  });

export type WorkflowExecutionWithStepResults = z.infer<
  typeof WorkflowExecutionWithStepResultsSchema
>;
/**
 * Event Type Enum
 *
 * Event types for the unified events table:
 * - signal: External signal (human-in-the-loop)
 * - timer: Durable sleep wake-up
 * - message: Inter-workflow communication (send/recv)
 * - output: Published value (setEvent/getEvent)
 * - step_started: Observability - step began
 * - step_completed: Observability - step finished
 * - workflow_started: Workflow began execution
 * - workflow_completed: Workflow finished
 */
export const EventTypeEnum = z.enum([
  "signal",
  "timer",
  "message",
  "output",
  "step_started",
  "step_completed",
  "workflow_started",
  "workflow_completed",
]);

export type EventType = z.infer<typeof EventTypeEnum>;

/**
 * Workflow Event Schema
 *
 * Unified events table for signals, timers, messages, and observability.
 */
export const WorkflowEventSchema = BaseCollectionEntitySchema.extend({
  execution_id: z.string(),
  type: EventTypeEnum,
  name: z.string().nullish(),
  payload: z.unknown().optional(),
  visible_at: z.number().nullish(),
  consumed_at: z.number().nullish(),
  source_execution_id: z.string().nullish(),
});

export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;

/**
 * Workflow entity schema for workflows
 * Extends BaseCollectionEntitySchema with workflow-specific fields
 * Base schema already includes: id, title, created_at, updated_at, created_by, updated_by
 */
export const WorkflowSchema = BaseCollectionEntitySchema.extend({
  description: z.string().optional().describe("Workflow description"),

  /**
   * Steps as a flat array.
   * - Parallelization is automatically determined by @ref dependencies
   * - Steps with no dependencies run in parallel
   * - Steps depending on other steps wait for them to complete
   * - Use config.forEach for iteration, config.parallel for explicit grouping
   */
  steps: z
    .array(StepSchema)
    .describe(
      "Flat array of steps - parallelization is auto-determined from @ref dependencies",
    ),
});

export type Workflow = z.infer<typeof WorkflowSchema>;

/**
 * WORKFLOW Collection Binding
 *
 * Collection bindings for workflows (read-only).
 * Provides LIST and GET operations for workflows.
 */
export const WORKFLOWS_COLLECTION_BINDING = createCollectionBindings(
  "workflow",
  WorkflowSchema,
);

const DEFAULT_STEP_CONFIG: StepConfig = {
  maxAttempts: 1,
  timeoutMs: 30000,
};

export const DEFAULT_SLEEP_STEP: Omit<Step, "name"> = {
  action: {
    sleepMs: 1000,
  },
};

export const DEFAULT_WAIT_FOR_SIGNAL_STEP: Omit<Step, "name"> = {
  action: {
    signalName: "signal_name",
  },
};
export const DEFAULT_TOOL_STEP: Omit<Step, "name"> = {
  action: {
    toolName: "",
    connectionId: "",
  },
  input: {},
  config: DEFAULT_STEP_CONFIG,
};
export const DEFAULT_CODE_STEP: Step = {
  name: "Initial Step",
  action: {
    code: `
  interface Input {
    example: string;
  }

  interface Output {
    result: unknown;
  }
    
  export default async function(input: Input): Promise<Output> { 
    return {
      result: input
    }
  }`,
  },
  config: DEFAULT_STEP_CONFIG,
};

export const createDefaultWorkflow = (id?: string): Workflow => ({
  id: id || crypto.randomUUID(),
  title: "Default Workflow",
  description: "The default workflow for the toolkit",
  steps: [DEFAULT_CODE_STEP],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const WORKFLOW_EXECUTIONS_COLLECTION_BINDING = createCollectionBindings(
  "workflow_execution",
  WorkflowExecutionSchema,
  {
    readOnly: true,
  },
);

export const EXECUTION_STEP_RESULTS_COLLECTION_BINDING =
  createCollectionBindings(
    "execution_step_results",
    WorkflowExecutionStepResultSchema,
    {
      readOnly: true,
    },
  );

export const WORKFLOW_EVENTS_COLLECTION_BINDING = createCollectionBindings(
  "workflow_events",
  WorkflowEventSchema,
  {
    readOnly: true,
  },
);

/**
 * WORKFLOWS Binding
 *
 * Defines the interface for workflow providers.
 * Any MCP that implements this binding can provide configurable workflows.
 *
 * Required tools:
 * - COLLECTION_WORKFLOW_LIST: List available workflows with their configurations
 * - COLLECTION_WORKFLOW_GET: Get a single workflow by ID (includes steps and triggers)
 */
export const WORKFLOW_COLLECTIONS_BINDINGS = [
  ...WORKFLOWS_COLLECTION_BINDING,
  ...WORKFLOW_EXECUTIONS_COLLECTION_BINDING,
  ...EXECUTION_STEP_RESULTS_COLLECTION_BINDING,
  ...WORKFLOW_EVENTS_COLLECTION_BINDING,
] as const satisfies Binder;

export const WORKFLOW_BINDING = [
  {
    name: "WORKFLOW_START" as const,
    inputSchema: z.object({
      workflowId: z.string().describe("The workflow ID to execute"),
      input: z
        .record(z.unknown())
        .optional()
        .describe("Input data for the workflow"),
      startAtEpochMs: z
        .number()
        .default(Date.now())
        .optional()
        .describe(
          "The start time of the workflow in epoch milliseconds. Defaults to now.",
        ),
      timeoutMs: z
        .number()
        .default(30000)
        .optional()
        .describe(
          "The timeout for the workflow in milliseconds. Defaults to 30000.",
        ),
    }),
    outputSchema: z.object({
      executionId: z.string(),
    }),
  },
  {
    name: "SEND_SIGNAL" as const,
    inputSchema: z.object({
      executionId: z.string().describe("The execution ID to send signal to"),
      signalName: z
        .string()
        .describe("Name of the signal (used by workflow to filter)"),
      payload: z
        .unknown()
        .optional()
        .describe("Optional data payload to send with the signal"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      signalId: z.string().optional(),
      message: z.string().optional(),
    }),
  },
  ...WORKFLOW_COLLECTIONS_BINDINGS,
] satisfies ToolBinder[];

export const WorkflowBinding = bindingClient(WORKFLOW_BINDING);

/**
 * DAG (Directed Acyclic Graph) utilities for workflow step execution
 *
 * Pure TypeScript functions for analyzing step dependencies and grouping
 * steps into execution levels for parallel execution.
 *
 * Can be used in both frontend (visualization) and backend (execution).
 */

/**
 * Minimal step interface for DAG computation.
 * This allows the DAG utilities to work with any step-like object.
 */
export interface DAGStep {
  name: string;
  input?: unknown;
  config?: {
    loop?: LoopConfig;
  };
}

/**
 * Extract all @ref references from a value recursively.
 * Finds patterns like @stepName or @stepName.field
 *
 * @param input - Any value that might contain @ref strings
 * @returns Array of unique reference names (without @ prefix)
 */
export function getAllRefs(input: unknown): string[] {
  const refs: string[] = [];

  function traverse(value: unknown) {
    if (typeof value === "string") {
      const matches = value.match(/@(\w+)/g);
      if (matches) {
        refs.push(...matches.map((m) => m.substring(1))); // Remove @ prefix
      }
    } else if (Array.isArray(value)) {
      value.forEach(traverse);
    } else if (typeof value === "object" && value !== null) {
      Object.values(value).forEach(traverse);
    }
  }

  traverse(input);
  return [...new Set(refs)].sort(); // Dedupe and sort for consistent results
}

/**
 * Get the dependencies of a step (other steps it references).
 * Only returns dependencies that are actual step names (filters out built-ins like "item", "index", "input").
 *
 * @param step - The step to analyze
 * @param allStepNames - Set of all step names in the workflow
 * @returns Array of step names this step depends on
 */
export function getStepDependencies(
  step: DAGStep,
  allStepNames: Set<string>,
): string[] {
  const deps: string[] = [];

  function traverse(value: unknown) {
    if (typeof value === "string") {
      // Match @stepName or @stepName.something patterns
      const matches = value.match(/@(\w+)/g);
      if (matches) {
        for (const match of matches) {
          const refName = match.substring(1); // Remove @
          // Only count as dependency if it references another step
          // (not "item", "index", "input" from forEach or workflow input)
          if (allStepNames.has(refName)) {
            deps.push(refName);
          }
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach(traverse);
    } else if (typeof value === "object" && value !== null) {
      Object.values(value).forEach(traverse);
    }
  }

  traverse(step.input);
  if (step.config?.loop?.for?.items) {
    traverse(step.config.loop.for.items);
  }

  return [...new Set(deps)];
}

/**
 * Build edges for the DAG: [fromStep, toStep][]
 */
export function buildDagEdges(steps: Step[]): [string, string][] {
  const stepNames = new Set(steps.map((s) => s.name));
  const edges: [string, string][] = [];

  for (const step of steps) {
    const deps = getStepDependencies(step, stepNames);
    for (const dep of deps) {
      edges.push([dep, step.name]);
    }
  }

  return edges;
}

/**
 * Compute topological levels for all steps.
 * Level 0 = no dependencies on other steps
 * Level N = depends on at least one step at level N-1
 *
 * @param steps - Array of steps to analyze
 * @returns Map from step name to level number
 */
export function computeStepLevels<T extends DAGStep>(
  steps: T[],
): Map<string, number> {
  const stepNames = new Set(steps.map((s) => s.name));
  const levels = new Map<string, number>();

  // Build dependency map
  const depsMap = new Map<string, string[]>();
  for (const step of steps) {
    depsMap.set(step.name, getStepDependencies(step, stepNames));
  }

  // Compute level for each step (with memoization)
  function getLevel(stepName: string, visited: Set<string>): number {
    if (levels.has(stepName)) return levels.get(stepName)!;
    if (visited.has(stepName)) return 0; // Cycle detection

    visited.add(stepName);
    const deps = depsMap.get(stepName) || [];

    if (deps.length === 0) {
      levels.set(stepName, 0);
      return 0;
    }

    const maxDepLevel = Math.max(...deps.map((d) => getLevel(d, visited)));
    const level = maxDepLevel + 1;
    levels.set(stepName, level);
    return level;
  }

  for (const step of steps) {
    getLevel(step.name, new Set());
  }

  return levels;
}

/**
 * Group steps by their execution level.
 * Steps at the same level have no dependencies on each other and can run in parallel.
 *
 * @param steps - Array of steps to group
 * @returns Array of step arrays, where index is the level
 */
export function groupStepsByLevel<T extends DAGStep>(steps: T[]): T[][] {
  const levels = computeStepLevels(steps);
  const maxLevel = Math.max(...Array.from(levels.values()), -1);

  const grouped: T[][] = [];
  for (let level = 0; level <= maxLevel; level++) {
    const stepsAtLevel = steps.filter((s) => levels.get(s.name) === level);
    if (stepsAtLevel.length > 0) {
      grouped.push(stepsAtLevel);
    }
  }

  return grouped;
}

/**
 * Get the dependency signature for a step (for grouping steps with same deps).
 *
 * @param step - The step to get signature for
 * @returns Comma-separated sorted list of dependencies
 */
export function getRefSignature(step: DAGStep): string {
  const inputRefs = getAllRefs(step.input);
  const forEachRefs = step.config?.loop?.for?.items
    ? getAllRefs(step.config.loop.for.items)
    : [];
  const allRefs = [...new Set([...inputRefs, ...forEachRefs])].sort();
  return allRefs.join(",");
}

/**
 * Build a dependency graph for visualization.
 * Returns edges as [fromStep, toStep] pairs.
 *
 * @param steps - Array of steps
 * @returns Array of [source, target] pairs representing edges
 */
export function buildDependencyEdges<T extends DAGStep>(
  steps: T[],
): [string, string][] {
  const stepNames = new Set(steps.map((s) => s.name));
  const edges: [string, string][] = [];

  for (const step of steps) {
    const deps = getStepDependencies(step, stepNames);
    for (const dep of deps) {
      edges.push([dep, step.name]);
    }
  }

  return edges;
}

/**
 * Validate that there are no cycles in the step dependencies.
 *
 * @param steps - Array of steps to validate
 * @returns Object with isValid and optional error message
 */
export function validateNoCycles<T extends DAGStep>(
  steps: T[],
): { isValid: boolean; error?: string } {
  const stepNames = new Set(steps.map((s) => s.name));
  const depsMap = new Map<string, string[]>();

  for (const step of steps) {
    depsMap.set(step.name, getStepDependencies(step, stepNames));
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(stepName: string, path: string[]): string[] | null {
    if (recursionStack.has(stepName)) {
      return [...path, stepName];
    }
    if (visited.has(stepName)) {
      return null;
    }

    visited.add(stepName);
    recursionStack.add(stepName);

    const deps = depsMap.get(stepName) || [];
    for (const dep of deps) {
      const cycle = hasCycle(dep, [...path, stepName]);
      if (cycle) return cycle;
    }

    recursionStack.delete(stepName);
    return null;
  }

  for (const step of steps) {
    const cycle = hasCycle(step.name, []);
    if (cycle) {
      return {
        isValid: false,
        error: `Circular dependency detected: ${cycle.join(" -> ")}`,
      };
    }
  }

  return { isValid: true };
}
