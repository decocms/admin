import { z } from "zod";
import type { JSONSchema7 } from "json-schema";

// ============= Core Types =============
// All workflow types in one central location for reuse

// JSON Schema type for input/output schemas
export type JSONSchema = JSONSchema7;

// Tool reference with integration
export interface ToolReference {
  integrationId: string; // Clean ID without prefix
  toolName: string;
  inputSchema?: JSONSchema;
  outputSchema?: JSONSchema;
  description?: string;
}

// Step execution result
export interface StepExecutionResult {
  executedAt: string; // ISO date
  value: unknown; // Result data
  error?: string; // Error message if failed
  duration?: number; // Execution time in ms
}

// Form state for workflow inputs
export interface WorkflowFormState {
  stepId: string;
  values: Record<string, unknown>;
  isDirty: boolean;
  isValid: boolean;
  errors: Record<string, string>;
}

// ============= Zod Schemas =============

export const WorkflowStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  prompt: z.string(), // User's original prompt
  code: z.string(), // Generated ES module code
  inputSchema: z.custom<JSONSchema>().optional(), // Typed JSON Schema
  outputSchema: z.custom<JSONSchema>().optional(), // Typed JSON Schema
  usedTools: z.array(z.custom<ToolReference>()), // Typed tool references
  logoUrl: z.string().optional(),
  config: z
    .object({
      retry: z.number().default(3),
      timeout: z.number().default(30000),
    })
    .optional(),
});

export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  steps: z.array(WorkflowStepSchema),

  // Workflow execution state
  executionState: z
    .record(z.string(), z.custom<StepExecutionResult>())
    .default({}),

  // Form states for each step that requires input
  formStates: z.record(z.string(), z.custom<WorkflowFormState>()).optional(),

  // Global workflow input schema (if needed)
  inputSchema: z.custom<JSONSchema>().optional(),
  outputSchema: z.custom<JSONSchema>().optional(),

  // Workflow metadata
  createdAt: z.string(),
  updatedAt: z.string(),
  lastExecutedAt: z.string().optional(),
});

// ============= Type Exports =============

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;

// Runtime types for execution
export interface StepContext {
  readWorkflowInput: () => unknown;
  getStepResult: (stepId: string) => unknown;
  env: Record<string, Record<string, Function>>;
}

export interface ExecutionContext {
  workflow: Workflow;
  currentStepId: string;
  state: Record<string, StepExecutionResult>;
  formValues?: Record<string, unknown>;
}

// Legacy compatibility exports (to be removed gradually)
export type WorkflowDefinition = Workflow;
export const WorkflowDefinitionSchema = WorkflowSchema;
