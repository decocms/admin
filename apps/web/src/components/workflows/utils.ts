import type { Workflow, WorkflowRun, WorkflowStats } from "./types.ts";

/**
 * Determines if a status is considered successful
 */
function isSuccessStatus(status: string): boolean {
  const successStatuses = [
    "success",
    "succeeded",
    "completed",
    "complete",
    "finished",
  ];
  return successStatuses.includes(status.toLowerCase());
}

/**
 * Determines if a status is considered an error
 */
function isErrorStatus(status: string): boolean {
  const errorStatuses = [
    "failed",
    "error",
    "errored",
    "failure",
    "cancelled",
    "canceled",
    "timeout",
  ];
  return errorStatuses.includes(status.toLowerCase());
}

/**
 * Determines if a status is considered pending
 */
function isPendingStatus(status: string): boolean {
  const pendingStatuses = [
    "pending",
    "queued",
    "waiting",
    "scheduled",
  ];
  return pendingStatuses.includes(status.toLowerCase());
}

/**
 * Determines if a status is considered running
 */
function isRunningStatus(status: string): boolean {
  const runningStatuses = [
    "running",
    "in_progress",
    "executing",
    "active",
    "processing",
  ];
  return runningStatuses.includes(status.toLowerCase());
}



/**
 * Get status badge variant for consistent styling
 */
export function getStatusBadgeVariant(
  status: string,
): "default" | "destructive" | "secondary" | "outline" | "success" {
  if (isSuccessStatus(status)) return "success";
  if (isErrorStatus(status)) return "destructive";
  if (isRunningStatus(status)) return "secondary";
  return "outline";
}

/**
 * Format status for display
 */
export function formatStatus(status: string): string {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "errored":
      return "Error";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/**
 * Sort unique workflows by various criteria
 */
export function sortWorkflows(
  workflows: Workflow[],
  sortKey: string,
  direction: "asc" | "desc",
): Workflow[] {
  return [...workflows].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (sortKey) {
      case "workflowName":
        aVal = a.workflowName.toLowerCase();
        bVal = b.workflowName.toLowerCase();
        break;
      case "runCount":
        aVal = a.runCount;
        bVal = b.runCount;
        break;
      case "lastRun":
        aVal = a.lastRunTimestamp || 0;
        bVal = b.lastRunTimestamp || 0;
        break;
      case "lastStatus":
        aVal = a.lastRunStatus;
        bVal = b.lastRunStatus;
        break;
      default:
        aVal = a.workflowName.toLowerCase();
        bVal = b.workflowName.toLowerCase();
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return direction === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });
}
