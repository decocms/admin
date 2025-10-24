import { memo } from "react";

export const StepError = memo(function StepError({
  error,
}: {
  error: unknown;
}) {
  if (!error) return null;

  // Runtime type guards to safely extract error name and message
  let errorName = "Error";
  let errorMessage = "An error occurred";

  if (typeof error === "string") {
    // If error is a string, use it as the message
    errorMessage = error;
  } else if (error instanceof Error) {
    // If error is an Error instance, read name and message
    errorName = error.name;
    errorMessage = error.message || errorMessage;
  } else if (typeof error === "object" && error !== null) {
    // If error is an object, safely read name and message properties
    const errObj = error as Record<string, unknown>;

    if (typeof errObj.name === "string" && errObj.name) {
      errorName = errObj.name;
    }

    if (typeof errObj.message === "string" && errObj.message) {
      errorMessage = errObj.message;
    } else {
      // If no valid message property, stringify the object
      try {
        errorMessage = JSON.stringify(error);
      } catch {
        errorMessage = String(error);
      }
    }
  } else {
    // For all other types (number, boolean, etc.), convert to string
    errorMessage = String(error);
  }

  return (
    <div className="text-xs bg-destructive/10 text-destructive rounded p-2 min-w-0 overflow-hidden">
      <div className="font-semibold break-all">{errorName}</div>
      <div className="mt-1 break-all">{errorMessage}</div>
    </div>
  );
});
