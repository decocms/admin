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
