import { memo } from "react";

interface StepTitleProps {
  stepName: string;
  description?: string;
}

export const StepTitle = memo(function StepTitle({
  stepName,
  description,
}: StepTitleProps) {
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <span className="font-medium text-base truncate">{String(stepName)}</span>
      {description && (
        <span className="text-sm text-muted-foreground">{description}</span>
      )}
    </div>
  );
});
