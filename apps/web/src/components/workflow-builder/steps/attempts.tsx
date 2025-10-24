import { Icon } from "@deco/ui/components/icon.tsx";
import { memo } from "react";

interface StepAttemptsProps {
  attempts: Array<{
    success?: boolean | null;
    error?: { message?: string; name?: string } | null;
    start?: string | null;
    end?: string | null;
  }>;
}

export const StepAttempts = memo(function StepAttempts({
  attempts,
}: StepAttemptsProps) {
  if (!attempts || attempts.length <= 1) return null;

  return (
    <details className="text-xs min-w-0 overflow-hidden">
      <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
        {attempts.length} attempts
      </summary>
      <div className="mt-2 space-y-2 pl-4 min-w-0 overflow-hidden">
        {attempts.map((attempt, attemptIdx) => (
          <div
            key={attemptIdx}
            className="border-l-2 pl-2 py-1 min-w-0 overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <span>Attempt {attemptIdx + 1}</span>
              {attempt.success ? (
                <Icon name="check_circle" size={12} className="text-success" />
              ) : (
                <Icon name="error" size={12} className="text-destructive" />
              )}
            </div>
            {attempt.error && (
              <div className="text-destructive mt-1 break-all">
                {String(attempt.error.message || "Error")}
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
});
