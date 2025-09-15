import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep as CloudflareWorkflowStep,
  WorkflowStepConfig,
  RpcTarget,
} from "cloudflare:workers";

export type { WorkflowStepConfig };

export interface Runnable extends RpcTarget {
  run: (input: unknown, state: WorkflowState) => Promise<Rpc.Serializable<unknown>>;
}
export interface WorkflowState<T = unknown> {
  input: T;
  steps: Record<string, unknown>;
  sleep: (name: string, duration: number) => Promise<void>;
}

export interface WorkflowStep {
  name: string;
  config?: WorkflowStepConfig;
  fn: Rpc.Stub<Runnable>;
}

export interface WorkflowRunnerProps<T = unknown> {
  input: T;
  steps: WorkflowStep[];
  state?: Record<string, unknown>;
}

export class WorkflowRunner extends WorkflowEntrypoint {
  override async run(
    event: Readonly<WorkflowEvent<WorkflowRunnerProps>>,
    cfStep: CloudflareWorkflowStep,
  ) {
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
          const runResult = await step.fn.run(prev, {
            ...workflowState,
            sleep: (name, duration) =>
              cfStep.sleep(`${step.name}-${name}`, duration),
          })
          return runResult as Rpc.Serializable<unknown>;
        }
        ));
      workflowState.steps[step.name] = prev;
    }
    return prev;
  }
}
