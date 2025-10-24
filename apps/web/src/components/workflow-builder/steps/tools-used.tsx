import { memo } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useStepTools } from "../../../stores/workflows/hooks.ts";

interface StepToolsUsedProps {
  stepName: string;
}

export const StepToolsUsed = memo(function StepToolsUsed({
  stepName,
}: StepToolsUsedProps) {
  const tools = useStepTools(stepName);

  if (!tools || tools.length === 0) return null;

  return (
    <div className="border-b border-base-border bg-background p-4 flex flex-col gap-4 min-w-0 overflow-hidden">
      <p className="font-mono text-sm text-muted-foreground uppercase leading-5">
        Tools Used
      </p>
      <div className="flex flex-wrap gap-3 min-w-0">
        {tools.map((tool, idx) => (
          <div
            key={idx}
            className="bg-secondary border border-base-border flex items-center gap-1 px-1 py-0.5 rounded-lg shrink-0"
          >
            {tool.integration?.icon && (
              <div className="size-4 rounded-md bg-background border border-border/10 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={tool.integration.icon}
                  alt={tool.integration.name}
                  className="size-3 object-contain"
                />
              </div>
            )}
            <span className="text-sm text-foreground font-normal leading-5 overflow-hidden text-ellipsis whitespace-nowrap">
              {tool.name}
            </span>
            <Icon
              name="close"
              size={14}
              className="text-muted-foreground shrink-0"
            />
          </div>
        ))}
      </div>
    </div>
  );
});
