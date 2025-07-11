// Types for workflow data structures

// Original workflow run data from API
export interface WorkflowRun {
  workflowName: string;
  runId: string;
  createdAt: number;
  updatedAt: number;
  resourceId: string | null;
  status: string;
}

// Unique workflow with aggregated statistics
export interface UniqueWorkflow {
  name: string;
  totalRuns: number;
  lastRun: {
    date: number;
    status: string;
    runId: string;
  };
  successCount: number;
  errorCount: number;
  firstCreated: number;
  lastUpdated: number;
}

// Workflow statistics for the detail page
export interface WorkflowStats {
  totalRuns: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  runningCount: number;
  successRate: number;
  lastRun?: {
    date: number;
    status: string;
    runId: string;
  };
  firstRun?: {
    date: number;
    runId: string;
  };
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
  workflows: WorkflowRun[];
  pagination: {
    page?: number;
    per_page?: number;
  };
}
