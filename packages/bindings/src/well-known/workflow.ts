/**
 * Agents Well-Known Binding
 *
 * Defines the interface for AI agent providers.
 * Any MCP that implements this binding can provide configurable AI agents
 * with custom instructions and tool access controls.
 *
 * This binding uses collection bindings for LIST and GET operations (read-only).
 */

import { z } from "zod";
import type { Binder } from "../core/binder";
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
 * Step Schema - Unified schema for all step types
 *
 * Step types:
 * - tool: Call external service via MCP (non-deterministic, checkpointed)
 * - transform: Pure TypeScript data transformation (deterministic, replayable)
 * - sleep: Wait for time
 * - waitForSignal: Block until external signal (human-in-the-loop)
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
  config: z
    .object({
      maxAttempts: z.number().default(3).describe("Maximum retry attempts"),
      backoffMs: z
        .number()
        .default(1000)
        .describe("Initial backoff in milliseconds"),
      timeoutMs: z.number().default(10000).describe("Timeout in milliseconds"),
    })
    .optional()
    .describe("Step configuration (max attempts, backoff, timeout)"),
});

export type Step = z.infer<typeof StepSchema>;

/**
 * Trigger Schema - Fire another workflow when execution completes
 */
export const TriggerSchema = z.object({
  /**
   * Target workflow ID to execute
   */
  workflowId: z.string().describe("Target workflow ID to trigger"),

  /**
   * Input for the new execution (uses @refs like step inputs)
   * Maps output data to workflow input fields.
   *
   * If any @ref doesn't resolve (property missing), this trigger is SKIPPED.
   */
  input: z
    .record(z.unknown())
    .describe(
      "Input mapping with @refs from current workflow output. Example: { 'user_id': '@stepName.output.user_id' }",
    ),
});

export type Trigger = z.infer<typeof TriggerSchema>;

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
  .enum(["pending", "running", "completed", "cancelled"])
  .default("pending");
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
  output: z.unknown().optional(),
  parent_execution_id: z.string().nullish(),
  completed_at_epoch_ms: z.number().nullish(),
  locked_until_epoch_ms: z.number().nullish(),
  lock_id: z.string().nullish(),
  retry_count: z.number().default(0),
  max_retries: z.number().default(10),
  error: z.string().nullish(),
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
   * Steps organized into phases.
   * - Phases execute sequentially
   * - Steps within a phase execute in parallel
   */
  steps: z
    .array(z.array(StepSchema))
    .describe("2D array: phases (sequential) containing steps (parallel)"),

  /**
   * Triggers to fire when execution completes successfully
   */
  triggers: z
    .array(TriggerSchema)
    .optional()
    .describe("Workflows to trigger on completion"),
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

export const WORKFLOW_EXECUTIONS_COLLECTION_BINDING = createCollectionBindings(
  "workflow_execution",
  WorkflowExecutionSchema,
  {
    readOnly: true,
  },
);

export const WORKFLOW_STEP_RESULTS_COLLECTION_BINDING =
  createCollectionBindings(
    "workflow_execution_step_results",
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
export const WORKFLOWS_BINDING = [
  ...WORKFLOWS_COLLECTION_BINDING,
  ...WORKFLOW_EXECUTIONS_COLLECTION_BINDING,
  ...WORKFLOW_STEP_RESULTS_COLLECTION_BINDING,
  ...WORKFLOW_EVENTS_COLLECTION_BINDING,
] as const satisfies Binder;
