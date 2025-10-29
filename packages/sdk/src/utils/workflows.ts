export type WorkflowStepConfig = {
  retries: {
    limit: number;
    delay: number;
    backoff: "constant" | "linear" | "exponential";
  };
  timeout: number;
};

export const DEFAULT_WORKFLOW_STEP_CONFIG: WorkflowStepConfig = {
  retries: {
    limit: 2,
    delay: 2000, // 2 seconds
    backoff: "exponential",
  },
  timeout: 300_000, // 5 minutes
};
