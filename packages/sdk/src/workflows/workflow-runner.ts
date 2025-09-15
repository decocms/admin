import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep as CloudflareWorkflowStep,
  WorkflowStepConfig,
} from "cloudflare:workers";

export type { WorkflowStepConfig };
export interface WorkflowState<T = unknown> {
  input: T;
  steps: Record<string, unknown>;
  sleep: (name: string, duration: number) => Promise<void>;
}

export interface WorkflowStep {
  name: string;
  config?: WorkflowStepConfig;
  fn: (
    input: unknown,
    state: WorkflowState,
  ) => Promise<Rpc.Serializable<unknown>>;
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
        (await cfStep.do(step.name, step.config ?? {}, () =>
          step.fn(prev, {
            ...workflowState,
            sleep: (name, duration) =>
              cfStep.sleep(`${step.name}-${name}`, duration),
          }),
        ));
      workflowState.steps[step.name] = prev;
    }
    return prev;
  }
}
