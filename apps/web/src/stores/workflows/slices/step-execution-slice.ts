import type { StateCreator } from "zustand";
import type { Store, StepExecution } from "../store";
import type {
  MCPConnection,
  ProjectLocator,
  MCPToolCall,
  MCPToolCallResult,
} from "@deco/sdk";

export interface RunStepParams {
  stepName: string;
  stepDefinition: {
    name: string;
    inputSchema?: unknown;
  };
  input: Record<string, unknown>;
  connection: MCPConnection | { id: string };
  locator?: ProjectLocator;
  workflowUri: string;
  stepOutputs: Record<string, unknown>;
  firstStepInput?: unknown;
  callTool: (
    connection: MCPConnection | { id: string },
    toolCallArgs: MCPToolCall,
    locator?: ProjectLocator,
  ) => Promise<MCPToolCallResult | unknown>;
  resolveAtRefsInInput: (
    input: unknown,
    stepOutputs: Record<string, unknown>,
    firstStepInput?: unknown,
  ) => {
    resolved: unknown;
    errors?: Array<{ ref: string; error: string }>;
  };
  unwrapMCPResponse: (content: unknown) => unknown;
  onError?: (error: Error, workflowUri: string, context: string) => void;
}

export interface StepExecutionSlice {
  stepOutputs: Record<string, unknown>;
  stepInputs: Record<string, unknown>;
  stepExecutions: Record<string, StepExecution>;
  setStepOutput: (stepName: string, output: unknown) => void;
  setStepInput: (stepName: string, input: unknown) => void;
  setStepExecutionStart: (stepName: string) => void;
  setStepExecutionEnd: (
    stepName: string,
    success: boolean,
    error?: { name?: string; message?: string },
  ) => void;
  runStep: (params: RunStepParams) => Promise<void>;
}

export const createStepExecutionSlice: StateCreator<
  Store,
  [],
  [],
  StepExecutionSlice
> = (set, get) => ({
  stepOutputs: {},
  stepInputs: {},
  stepExecutions: {},

  setStepOutput: (stepName, output) =>
    set((state) => ({
      stepOutputs: { ...state.stepOutputs, [stepName]: output },
    })),

  setStepInput: (stepName, input) =>
    set((state) => ({
      stepInputs: { ...state.stepInputs, [stepName]: input },
      isDirty: true,
    })),

  setStepExecutionStart: (stepName) =>
    set((state) => ({
      stepExecutions: {
        ...state.stepExecutions,
        [stepName]: {
          start: new Date().toISOString(),
          end: undefined,
          error: null,
          success: undefined,
        },
      },
    })),

  setStepExecutionEnd: (stepName, success, error) =>
    set((state) => {
      const prev = state.stepExecutions[stepName] || {};
      return {
        stepExecutions: {
          ...state.stepExecutions,
          [stepName]: {
            ...prev,
            end: new Date().toISOString(),
            success,
            error: error || null,
          },
        },
      };
    }),

  runStep: async (params) => {
    const {
      stepName,
      stepDefinition,
      input,
      connection,
      locator,
      workflowUri,
      stepOutputs,
      firstStepInput,
      callTool,
      resolveAtRefsInInput,
      unwrapMCPResponse,
      onError,
    } = params;

    try {
      // Start execution tracking
      get().setStepExecutionStart(stepName);

      // Resolve @ references in input
      const { resolved, errors } = resolveAtRefsInInput(
        input,
        stepOutputs,
        firstStepInput,
      );

      if (errors && errors.length > 0) {
        const errorMessages = errors
          .map((e) => `${e.ref}: ${e.error}`)
          .join("\n");
        throw new Error(`Failed to resolve references:\n${errorMessages}`);
      }

      // Save input to store
      get().setStepInput(stepName, input);

      // Execute the tool
      const rawResult = await callTool(
        connection,
        {
          name: "DECO_WORKFLOW_RUN_STEP",
          arguments: {
            tool: stepDefinition,
            input: resolved,
          },
        },
        locator,
      );

      // Type guard to check if result has MCPToolCallResult shape
      const result = rawResult as MCPToolCallResult;

      // Check for errors in result
      const structuredContent = result.structuredContent as
        | { result?: { error?: unknown } }
        | undefined;
      const error = structuredContent?.result?.error;

      if (error) {
        throw new Error(
          `Tool execution failed: ${typeof error === "string" ? error : JSON.stringify(error)}`,
        );
      }

      if (result.isError) {
        const errorMessage =
          (Array.isArray(result.content) && result.content[0]?.text) ||
          "Unknown error";
        throw new Error(`Tool execution failed: ${errorMessage}`);
      }

      // Extract and save output
      const stepOutput = unwrapMCPResponse(result.structuredContent);
      const outputKey = stepDefinition?.name ?? stepName;

      if (stepOutput !== undefined) {
        get().setStepOutput(outputKey, stepOutput);
      }

      // Mark execution as successful
      get().setStepExecutionEnd(stepName, true);
    } catch (error) {
      console.error("Failed to run step", error);

      const errorObj =
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { name: "Error", message: String(error) };

      get().setStepExecutionEnd(stepName, false, errorObj);

      // Call error handler if provided
      if (onError && error instanceof Error) {
        onError(error, workflowUri, `Workflow Step: ${stepName}`);
      }

      throw error;
    }
  },
});
