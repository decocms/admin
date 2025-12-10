import { useMemo } from "react";
import { BellIcon, ClockIcon, CodeXml, Wrench } from "lucide-react";
import type { Step } from "@decocms/bindings/workflow";
import { Card, CardHeader, CardTitle } from "@deco/ui/components/card.tsx";
import { cn } from "@deco/ui/lib/utils.js";

// ============================================
// Step Icon
// ============================================

function getStepIcon(step: Step) {
  const { action } = step;

  if ("toolName" in action) {
    return <Wrench className="w-4 h-4" />;
  }
  if ("code" in action) {
    return <CodeXml className="w-4 h-4" />;
  }
  if ("sleepMs" in action || "sleepUntil" in action) {
    return <ClockIcon className="w-4 h-4" />;
  }
  if ("signalName" in action) {
    return <BellIcon className="w-4 h-4" />;
  }

  return <Wrench className="w-4 h-4" />;
}

// ============================================
// Step Card (Standalone)
// ============================================

interface StepCardProps {
  step: Step;
  icon?: React.ReactNode;
  iconBgColor?: string;
  className?: string;
}

/**
 * Simplified StepCard for use outside of React Flow.
 * For the full-featured node version, see nodes/step-node.tsx
 */
export function StepCard({
  step,
  icon,
  iconBgColor = "primary",
  className,
}: StepCardProps) {
  const displayIcon = useMemo(() => {
    if (icon) return icon;
    console.log("🚀 ~ displayIcon ~ step:", step);
    return getStepIcon(step);
  }, [icon, step]);

  return (
    <Card
      className={cn(
        "w-full p-0 px-3 h-12 group flex items-center justify-center relative cursor-pointer",
        "transition-colors duration-150",
        className,
      )}
    >
      <CardHeader className="flex items-center justify-between gap-2 p-0 w-full">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div
            className={cn(
              "h-6 w-6 p-1 flex-shrink-0 flex items-center justify-center rounded-md",
              `bg-${iconBgColor}`,
            )}
          >
            {displayIcon}
          </div>

          <CardTitle className="p-0 text-sm font-medium truncate">
            {step.name}
          </CardTitle>
        </div>
      </CardHeader>
    </Card>
  );
}

export default StepCard;
