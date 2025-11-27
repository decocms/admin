import type { ReactNode } from "react";
import { cn } from "@deco/ui/lib/utils.ts";

interface EmptyStateProps {
  image?: ReactNode;
  title: string;
  description: string | ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Default stacked cards illustration for empty states
 * PNG exported from Figma design
 */
function StackedCardsIllustration() {
  return (
    <img
      src="/empty-state-cards.png"
      alt=""
      width={218}
      height={190}
      aria-hidden="true"
    />
  );
}

export function EmptyState({
  image,
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-8 p-4",
        className,
      )}
    >
      {/* Image/Illustration */}
      <div className="flex items-center justify-center">
        {image ?? <StackedCardsIllustration />}
      </div>

      {/* Text content */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-lg font-medium text-foreground">{title}</h3>
          <div className="text-sm text-muted-foreground text-center max-w-[300px]">
            {description}
          </div>
        </div>

        {/* Actions */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
