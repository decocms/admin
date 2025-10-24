import { memo } from "react";

export const StepError = memo(function StepError({
  error,
}: {
  error: unknown;
}) {
  if (!error) return null;

  const errorObj = error as { name?: string; message?: string };

  return (
    <div className="text-xs bg-destructive/10 text-destructive rounded p-2 min-w-0 overflow-hidden">
      <div className="font-semibold break-all">
        {String(errorObj.name || "Error")}
      </div>
      <div className="mt-1 break-all">
        {String(errorObj.message || "An error occurred")}
      </div>
    </div>
  );
});
