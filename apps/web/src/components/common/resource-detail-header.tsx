import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

interface CodeActionProps {
  /** Whether the code viewer is open */
  isOpen: boolean;
  /** Toggle handler */
  onToggle: () => void;
  /** Whether code exists */
  hasCode?: boolean;
}

/**
 * Code viewer toggle button action
 */
export function CodeAction({
  isOpen,
  onToggle,
  hasCode = true,
}: CodeActionProps) {
  if (!hasCode) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className={cn("size-6 p-0", isOpen && "bg-accent")}
      onClick={onToggle}
      title="View Code"
    >
      <Icon
        name="code"
        className={isOpen ? "text-foreground" : "text-muted-foreground"}
      />
    </Button>
  );
}

interface SaveDiscardActionsProps {
  /** Whether there are unsaved changes */
  hasChanges: boolean;
  /** Save handler */
  onSave: () => void;
  /** Discard handler */
  onDiscard: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Custom label for discard button */
  discardLabel?: string;
  /** Custom label for save button */
  saveLabel?: string;
  /** Custom label for saving state */
  savingLabel?: string;
}

/**
 * Save and Discard action buttons
 * Only shows when hasChanges is true
 */
export function SaveDiscardActions({
  hasChanges,
  onSave,
  onDiscard,
  isSaving = false,
  discardLabel = "Discard",
  saveLabel = "Save",
  savingLabel = "Saving...",
}: SaveDiscardActionsProps) {
  if (!hasChanges) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={onDiscard}
        disabled={isSaving}
      >
        {discardLabel}
      </Button>
      <Button
        type="button"
        variant="default"
        size="xs"
        onClick={onSave}
        disabled={isSaving}
      >
        <Icon name="check" />
        {isSaving ? savingLabel : saveLabel}
      </Button>
    </>
  );
}

interface RefreshActionProps {
  /** Refresh handler */
  onRefresh: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
}

/**
 * Refresh action button
 */
export function RefreshAction({
  onRefresh,
  isRefreshing = false,
}: RefreshActionProps) {
  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      onClick={onRefresh}
      disabled={isRefreshing}
      className="size-6 p-0"
    >
      <Icon name="refresh" className={cn(isRefreshing && "animate-spin")} />
    </Button>
  );
}
