import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

interface ErrorBannerProps {
  message: string;
  errorCount?: number;
  onFix?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Error banner component that displays above the chat input
 * with a negative margin to create an overlapping effect
 */
export function ErrorBanner({
  message,
  errorCount,
  onFix,
  onDismiss,
  className,
}: ErrorBannerProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 items-start mb-[-10px] px-2 py-0 relative shrink-0 w-full",
        "animate-in fade-in slide-in-from-bottom-2 duration-200",
        className,
      )}
      style={{
        animationTimingFunction: "var(--ease-out-quad)",
      }}
    >
      <div className="bg-destructive/[0.03] border border-destructive/15 border-solid flex gap-2 items-center pb-4 pl-4 pr-2.5 pt-2.5 relative rounded-xl shrink-0 w-full">
        {/* Alert Icon */}
        <div className="relative shrink-0 size-5">
          <Icon name="error" size={20} className="text-destructive" />
        </div>

        {/* Error Message */}
        <p className="basis-0 grow h-5 leading-5 min-h-px min-w-px relative shrink-0 text-destructive text-sm font-normal">
          {message}
        </p>

        {/* Try to Fix Button */}
        {onFix && (
          <Button
            onClick={onFix}
            variant="outline"
            size="sm"
            className="bg-background border-input h-8 px-3 py-2 shrink-0 gap-2"
          >
            Try to fix
            {errorCount !== undefined && errorCount > 0 && (
              <span className="font-mono text-xs text-muted-foreground">
                {errorCount}
              </span>
            )}
          </Button>
        )}

        {/* Close Button */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="relative shrink-0 size-5 flex items-center justify-center hover:opacity-70 transition-opacity"
            aria-label="Dismiss error"
          >
            <Icon name="close" size={20} className="text-neutral-500" />
          </button>
        )}
      </div>
    </div>
  );
}
