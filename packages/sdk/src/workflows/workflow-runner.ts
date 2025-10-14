import {
  WorkflowStep as CloudflareWorkflowStep,
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStepConfig,
} from "cloudflare:workers";
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
} from "../mcp/index.ts";
import { asEnv, evalCodeAndReturnDefaultHandle } from "../mcp/tools/utils.ts";
import type { WorkflowStepDefinition } from "../mcp/workflows/api.ts";

export type { WorkflowStepConfig };

export type Runnable = (input: unknown) => Promise<Rpc.Serializable<unknown>>;

export interface WorkflowStep {
  name: string;
  config?: WorkflowStepConfig;
  fn: Runnable;
}

export interface WorkflowRunnerProps<T = unknown> {
  input: T;
  name: string;
  steps: WorkflowStepDefinition[];
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

export class WorkflowRunner extends WorkflowEntrypoint<Bindings> {
  protected bindingsCtx: BindingsContext;
  protected executionCtx: ExecutionContext;

  constructor(ctx: ExecutionContext, env: Bindings) {
    super(ctx, env);
    this.bindingsCtx = toBindingsContext(env);
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
   * Execute a step with resolved input
   */
  private async executeStep(
    stepDef: WorkflowStepDefinition,
    resolvedInput: Record<string, unknown>,
    appContext: AppContext,
    runtimeId: string,
  ): Promise<Rpc.Serializable<unknown>> {
    const client = MCPClient.forContext(appContext);

    // Load and execute the code step function
    using stepEvaluation = await evalCodeAndReturnDefaultHandle(
      stepDef.execute,
      runtimeId,
    );
    const {
      ctx: stepCtx,
      defaultHandle: stepDefaultHandle,
      guestConsole: stepConsole,
    } = stepEvaluation;

    // Create step context with env for integration tool calls
    const stepContext = {
      env: await asEnv(client),
    };

    // Call the function with resolved input and context
    const stepCallHandle = await callFunction(
      stepCtx,
      stepDefaultHandle,
      undefined,
      resolvedInput,
      stepContext,
    );

    const result = stepCtx.dump(stepCtx.unwrapResult(stepCallHandle));

    // Log any console output from the step execution
    if (stepConsole.logs.length > 0) {
      console.log(`Step '${stepDef.name}' logs:`, stepConsole.logs);
    }

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
    const {
      input: workflowInput,
      steps: stepDefinitions,
      state,
    } = event.payload;
    const runtimeId = appContext.locator?.value ?? "default";

    // Convert step definitions to actual runnable steps
    const steps = stepDefinitions.map((stepDef) =>
      this.convertStepDefinitionToStep(input, stepDef, appContext, runtimeId),
    );

    const workflowState = {
      input,
      steps: state ?? {},
    };
    let prev = input;
    for (const step of steps) {
      const start = performance.now();
      prev =
        state?.[step.name] ??
        (await cfStep.do(step.name, step.config ?? {}, () => {
          const nStart = performance.now();
          return contextStorage
            .run({ env: this.env, ctx: this.executionCtx }, () =>
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
            )
            .finally(() => {
              console.log(
                `[workflow-runner]: STEP_DO_INSIDE ${step.name} took ${performance.now() - nStart}ms`,
              );
            });
        }));

      console.log(
        `[workflow-runner]: STEP_DO ${step.name} took ${performance.now() - start}ms`,
      );
      workflowState.steps[step.name] = prev;
      if (event.payload.stopAfter === step.name) {
        break;
      }
    }

    // Return the last executed step's result
    const lastStepName = stepDefinitions[stepDefinitions.length - 1]?.name;
    return stepResults[lastStepName] as Rpc.Serializable<unknown>;
  }
}
