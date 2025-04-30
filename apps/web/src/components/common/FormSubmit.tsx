import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

interface Props {
  numberOfChanges: number;
  submitting?: boolean;
  onDiscard: () => void;
}

/**
 * Floating form submit button
 */
export function FormSubmitControls({
  numberOfChanges,
  submitting,
  onDiscard,
}: Props) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-1/2 -translate-x-1/2 bg-background",
        "shadow border boder-input rounded-full p-2",
        "flex items-center justify-center gap-2",
        "transition-transform",
        numberOfChanges > 0 ? "-translate-y-4" : "translate-y-full",
        "z-10",
      )}
    >
      <span className="ml-4 mr-2 text-nowrap hidden md:block">
        You have unsaved changes
      </span>
      <Button
        type="button"
        variant="outline"
        className="text-slate-700"
        onClick={onDiscard}
      >
        Discard
      </Button>
      <Button
        className="bg-primary-light text-primary-dark hover:bg-primary-light/90 gap-2"
        disabled={!numberOfChanges}
      >
        {submitting
          ? (
            <>
              <Spinner size="xs" />
              <span>Saving...</span>
            </>
          )
          : (
            <span>
              Save {numberOfChanges} change{numberOfChanges > 1 ? "s" : ""}
            </span>
          )}
      </Button>
    </div>
  );
}
