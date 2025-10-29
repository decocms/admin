import {
  WorkflowStep as CloudflareWorkflowStep,
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStepConfig,
} from "cloudflare:workers";
import postgres from "postgres";
import { callFunction, inspect } from "@deco/cf-sandbox";
import { contextStorage } from "../fetch.ts";
import {
  AppContext,
  type Bindings,
  type BindingsContext,
  PrincipalExecutionContext,
  State,
  toBindingsContext,
} from "../mcp/context.ts";
import {
  assertHasWorkspace,
  createResourceAccess,
  MCPClient,
  type MCPClientStub,
  type ProjectTools,
} from "../mcp/index.ts";
import type { WorkflowStepDefinition } from "../mcp/workflows/api.ts";
import {
  evalCodeAndReturnDefaultHandle,
  asEnv,
  validate,
} from "../mcp/tools/utils.ts";

// Import ref resolution utilities
// Note: These will need to be moved to the SDK package for proper import
function isAtRef(value: unknown): value is `@${string}` {
  return typeof value === "string" && value.startsWith("@");
}

function parseAtRef(ref: `@${string}`): {
  type: "step" | "input";
  id?: string;
  path?: string;
  resourceType?: string;
  resourceId?: string;
} {
  const refStr = ref.substring(1); // Remove @ prefix

  // Input reference: @input.path.to.value
  if (refStr.startsWith("input")) {
    const path = refStr.substring(6); // Remove 'input.'
    return { type: "input", path };
  }

  // Step reference: @stepId.path.to.value
  const [id, ...pathParts] = refStr.split(".");

  // If path starts with 'output.', remove it since stepResults already contains the output
  let path = pathParts.join(".");
  if (path.startsWith("output.")) {
    path = path.substring(7); // Remove 'output.'
  }

  return { type: "step", id, path };
}

function getValue(
  obj: Record<string, unknown> | unknown[] | unknown,
  path: string,
): unknown {
  if (!path) return obj;

  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[key];
    } else if (Array.isArray(current)) {
      const index = parseInt(key, 10);
      current = isNaN(index) ? undefined : current[index];
    } else {
      return undefined;
    }
  }

  return current;
}

function resolveAtRef(
  ref: `@${string}`,
  stepResults: Map<string, unknown>,
  globalInput?: unknown,
): { value: unknown; error?: string } {
  try {
    const parsed = parseAtRef(ref);

    switch (parsed.type) {
      case "input": {
        const value = getValue(
          (globalInput as Record<string, unknown>) || {},
          parsed.path || "",
        );
        if (value === undefined) {
          return { value: null, error: `Input path not found: ${parsed.path}` };
        }
        return { value };
      }

      case "step": {
        const identifier = parsed.id || "";
        const stepResult = stepResults.get(identifier);

        if (stepResult === undefined) {
          return {
            value: null,
            error: `Step not found or not executed: ${identifier}`,
          };
        }
        const value = getValue(stepResult, parsed.path || "");
        if (value === undefined) {
          return {
            value: null,
            error: `Path not found in step result: ${parsed.path}`,
          };
        }
        return { value };
      }

      default:
        return { value: null, error: `Unknown reference type: ${ref}` };
    }
  } catch (error) {
    return { value: null, error: `Failed to resolve ${ref}: ${String(error)}` };
  }
}

function resolveAtRefsInInput(
  input: unknown,
  stepResults: Map<string, unknown>,
  globalInput?: unknown,
): { resolved: unknown; errors?: Array<{ ref: string; error: string }> } {
  const errors: Array<{ ref: string; error: string }> = [];

  function resolveValue(value: unknown): unknown {
    // If it's an @ref, resolve it
    if (isAtRef(value)) {
      const result = resolveAtRef(value, stepResults, globalInput);
      if (result.error) {
        errors.push({ ref: value, error: result.error });
      }
      return result.value;
    }

    // If it's an array, resolve each element
    if (Array.isArray(value)) {
      return value.map((v) => resolveValue(v));
    }

    // If it's an object, resolve each property
    if (value !== null && typeof value === "object") {
      const resolvedObj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        resolvedObj[key] = resolveValue(val);
      }
      return resolvedObj;
    }

    // Primitive value, return as-is
    return value;
  }

  const resolved = resolveValue(input);
  return { resolved, errors: errors.length > 0 ? errors : undefined };
}

export type { WorkflowStepConfig };

export type Runnable = (
  input: unknown,
  state: WorkflowState,
) => Promise<Rpc.Serializable<unknown>>;
export interface WorkflowState<T = unknown> {
  input: T;
  steps: Record<string, unknown>;
  sleep: (name: string, duration: number) => Promise<void>;
  sleepUntil: (name: string, date: Date | number) => Promise<void>;
}

export interface WorkflowStep {
  name: string;
  config?: WorkflowStepConfig;
  fn: Runnable;
}

export interface WorkflowRunnerProps<T = unknown> {
  input: T;
  name: string;
  steps: WorkflowStepDefinition[]; // Changed from WorkflowStep[] to WorkflowStepDefinition[]
  stopAfter?: string;
  state?: Record<string, unknown>;
  context: Pick<PrincipalExecutionContext, "workspace" | "locator"> & {
    workflowURI: string;
    startedBy?: {
      id: string;
      email: string | undefined;
      name: string | undefined;
    };
    startedAt?: string;
  };
}

const DEFAULT_CONFIG: WorkflowStepConfig = {
  retries: {
    limit: 2,
    delay: 2000,
    backoff: "exponential",
  },
  timeout: "5 minutes",
};

export class WorkflowRunner extends WorkflowEntrypoint<Bindings> {
  protected bindingsCtx: BindingsContext;
  protected executionCtx: ExecutionContext;
  private sql: postgres.Sql;

  constructor(ctx: ExecutionContext, env: Bindings) {
    super(ctx, env);
    this.sql = postgres(env.DATABASE_URL, {
      max: 2,
    });
    this.bindingsCtx = toBindingsContext(env, this.sql);
    this.executionCtx = ctx;
  }

  async principalContextFromRunnerProps(
    props: WorkflowRunnerProps,
  ): Promise<PrincipalExecutionContext> {
    assertHasWorkspace(props.context);
    const resourceAccess = createResourceAccess();
    resourceAccess.grant(); // all calls are authorized by default
    const issuer = await this.bindingsCtx.jwtIssuer();
    const token = await issuer.issue({
      sub: `workflow:${props.name}:${props.context.workspace.value}`,
    });
    return {
      params: {},
      resourceAccess,
      workspace: props.context.workspace,
      locator: props.context.locator,
      token,
      user: issuer.decode(token),
    };
  }

  /**
   * Convert WorkflowStepDefinition to WorkflowStep with actual runnable functions
   */
  private convertStepDefinitionToStep(
    stepDef: WorkflowStepDefinition,
    appContext: AppContext,
    runtimeId: string,
    state?: Record<string, unknown>,
  ): WorkflowStep {
    assertHasWorkspace(appContext);
    const client = MCPClient.forContext(appContext);
    const workspace =
      typeof state?.workspace === "string" ? state.workspace : undefined;
    const authorization =
      typeof state?.authorization === "string"
        ? state.authorization
        : undefined;

    const config =
      "options" in stepDef ? (stepDef.options ?? {}) : DEFAULT_CONFIG;

    // The new schema structure has def containing the code definition
    const runnable: Runnable = async (input, state) => {
      if (!stepDef.def.execute) {
        throw new Error(
          `Step '${stepDef.def.name}' has no execute code defined`,
        );
      }

      // Use the step's input if provided, otherwise use the input passed from previous step
      let stepInput = stepDef.input ?? input;

      // Resolve @refs in the step input using previous step results
      // Convert state.steps (Record) to Map for resolution
      const stepResultsMap = new Map(Object.entries(state.steps));

      // Debug logging
      console.log(
        `[REF RESOLUTION] Step '${stepDef.def.name}' input before resolution:`,
        JSON.stringify(stepInput),
      );
      console.log(
        `[REF RESOLUTION] Available step results:`,
        Array.from(stepResultsMap.keys()),
      );

      const resolution = resolveAtRefsInInput(
        stepInput,
        stepResultsMap,
        state.input,
      );

      // Log any resolution errors
      if (resolution.errors && resolution.errors.length > 0) {
        console.error(
          `[REF RESOLUTION] Errors resolving refs in step '${stepDef.def.name}':`,
          resolution.errors,
        );
      }

      // Use the resolved input
      stepInput = resolution.resolved;
      console.log(
        `[REF RESOLUTION] Step '${stepDef.def.name}' input after resolution:`,
        JSON.stringify(stepInput),
      );

      // Validate resolved input against step's inputSchema
      if (stepDef.def.inputSchema) {
        const inputValidation = validate(
          resolution.resolved,
          stepDef.def.inputSchema,
        );
        if (!inputValidation.valid) {
          const errorMessage = `Step '${stepDef.def.name}' input validation failed after ref resolution: ${inspect(inputValidation.errors)}`;
          console.error(`[INPUT VALIDATION]`, errorMessage);
          throw new Error(errorMessage);
        }
      }

      return await this.runStepCode(
        stepInput,
        stepDef.def,
        client,
        runtimeId,
        workspace,
        authorization,
      );
    };

    return {
      name: stepDef.def.name,
      config,
      fn: runnable,
    };
  }

  /**
   * Run code for a step with the new schema structure
   */
  private async runStepCode(
    input: unknown,
    stepDef: {
      name?: string;
      execute?: string;
      dependencies?: Array<{ integrationId: string; toolNames?: string[] }>;
    },
    client: MCPClientStub<ProjectTools>,
    runtimeId: string,
    workspace?: string,
    authorization?: string,
  ): Promise<Rpc.Serializable<unknown>> {
    // Load and execute the code step function
    using stepEvaluation = await evalCodeAndReturnDefaultHandle(
      stepDef.execute!,
      runtimeId,
    );
    const {
      ctx: stepCtx,
      defaultHandle: stepDefaultHandle,
      guestConsole: stepConsole,
    } = stepEvaluation;

    // Create step context matching the new signature: (input, ctx)
    const stepContext = {
      env: asEnv(client, {
        authorization,
        workspace,
        dependencies: stepDef.dependencies,
      }),
    };

    // Call the function with (input, ctx) signature
    const stepCallHandle = await callFunction(
      stepCtx,
      stepDefaultHandle,
      undefined,
      input,
      stepContext,
    );

    const result = stepCtx.dump(stepCtx.unwrapResult(stepCallHandle));

    // Log any console output from the step execution
    if (stepConsole.logs.length > 0) {
      console.log(`Step '${stepDef.name}' logs:`, stepConsole.logs);
    }

    // Return the full result object (with .result wrapper) so refs can access it
    // Refs use format @step.output.result.X which maps to result.X after stripping output.
    console.log(
      `[STEP EXECUTION] Raw result structure:`,
      JSON.stringify(result),
    );
    return result as Rpc.Serializable<unknown>;
  }

  override async run(
    event: Readonly<WorkflowEvent<WorkflowRunnerProps>>,
    cfStep: CloudflareWorkflowStep,
  ) {
    const appContext: AppContext = {
      ...(await this.principalContextFromRunnerProps(event.payload)),
      ...this.bindingsCtx,
    };
    const { input, steps: stepDefinitions, state } = event.payload;
    const runtimeId = appContext.locator?.value ?? "default";

    // Convert step definitions to actual runnable steps
    const steps = stepDefinitions.map((stepDef) =>
      this.convertStepDefinitionToStep(stepDef, appContext, runtimeId, state),
    );

    const workflowState: WorkflowState = {
      input,
      steps: state ?? {},
      // workspace: context?.workspace?.value,
      sleep: () => Promise.resolve(),
      sleepUntil: () => Promise.resolve(),
    };
    let prev = input;

    console.log(`[WORKFLOW START] Running ${steps.length} steps`);
    for (const step of steps) {
      prev =
        state?.[step.name] ??
        (await cfStep.do(step.name, step.config ?? {}, () => {
          return contextStorage.run(
            { env: this.env, ctx: this.executionCtx, sql: this.sql },
            () =>
              State.run(
                appContext,
                () =>
                  step.fn(prev, {
                    ...workflowState,
                    sleepUntil: (name, date) =>
                      cfStep.sleepUntil(`${step.name}-${name}`, date),
                    sleep: (name, duration) =>
                      cfStep.sleep(`${step.name}-${name}`, duration),
                  }) as Promise<Rpc.Serializable<unknown>>,
              ),
          );
        }));

      workflowState.steps[step.name] = prev;
      console.log(
        `[STEP RESULT] Stored result for step '${step.name}':`,
        JSON.stringify(prev),
      );
      if (event.payload.stopAfter === step.name) {
        break;
      }
    }
    return prev;
  }
}
