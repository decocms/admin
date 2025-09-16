import {
  WorkflowStep as CloudflareWorkflowStep,
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStepConfig,
} from "cloudflare:workers";
import {
  AppContext,
  PrincipalExecutionContext,
  toBindingsContext,
  type Bindings,
  type BindingsContext,
} from "../mcp/context.ts";
import { assertHasWorkspace, createResourceAccess } from "../mcp/index.ts";

export type { WorkflowStepConfig };

export type Runnable = (
  input: unknown,
  state: WorkflowState,
) => Promise<Rpc.Serializable<unknown>>;
export interface WorkflowState<T = unknown> {
  input: T;
  steps: Record<string, unknown>;
  sleep: (name: string, duration: number) => Promise<void>;
}

export interface WorkflowStep {
  name: string;
  config?: WorkflowStepConfig;
  fn: Runnable;
}

export interface WorkflowRunnerProps<T = unknown> {
  input: T;
  name: string;
  steps: WorkflowStep[];
  state?: Record<string, unknown>;
  context: Pick<PrincipalExecutionContext, "workspace" | "locator">;
}

export class WorkflowRunner extends WorkflowEntrypoint<Bindings> {
  protected bindingsCtx: BindingsContext;
  constructor(ctx: ExecutionContext, env: Bindings) {
    super(ctx, env);
    this.bindingsCtx = toBindingsContext(env);
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

  override async run(
    event: Readonly<WorkflowEvent<WorkflowRunnerProps>>,
    cfStep: CloudflareWorkflowStep,
  ) {
    const appContext: AppContext = {
      ...(await this.principalContextFromRunnerProps(event.payload)),
      ...this.bindingsCtx,
    };
    const { input, steps, state } = event.payload;
    const workflowState = {
      input,
      steps: state ?? {},
    };
    let prev = input;
    for (const step of steps) {
      prev =
        state?.[step.name] ??
        (await cfStep.do(step.name, step.config ?? {}, async () => {
          const runResult = await step.fn(prev, {
            ...workflowState,
            sleep: (name, duration) =>
              cfStep.sleep(`${step.name}-${name}`, duration),
          });
          return runResult as Rpc.Serializable<unknown>;
        }));
      workflowState.steps[step.name] = prev;
    }
    return prev;
  }
}
