// Types for workflow data structures

export interface WorkflowRun {
  workflowName: string;
  runId: string;
  createdAt: number;
  updatedAt?: number | null;
  status: string;
}

export interface Workflow {
  workflowName: string;
  runCount: number;
  lastRunTimestamp: string;
  lastRunStatus: string;
}

export interface WorkflowStats {
  totalRuns: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  runningCount: number;
  successRate: number;
  lastRun: {
    date: number;
    status: string;
  } | null;
  firstRun: {
    date: number;
    status: string;
  } | null;
}

// Status types for better type safety
export type WorkflowStatus =
  | "success"
  | "failed"
  | "running"
  | "pending"
  | "cancelled"
  | "completed"
  | "errored"
  | "in_progress";

// API response structure
export interface WorkflowsListResponse {
  workflows: Workflow[];
  pagination: {
    page?: number;
    per_page?: number;
  };
}

export interface WorkflowRunsResponse {
  runs: WorkflowRun[];
  stats: WorkflowStats;
  pagination: {
    page?: number;
    per_page?: number;
  };
}
