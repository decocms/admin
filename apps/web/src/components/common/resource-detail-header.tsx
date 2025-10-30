import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { ReactNode } from "react";
import { useResourceRoute } from "../resources-v2/route-context.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { formatResourceName } from "../../utils/format.ts";

interface ResourceDetailHeaderProps {
  /** The resource name to display */
  title: string;
  /** Custom action buttons to render on the right */
  actions?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable header component for resource detail views
 * Automatically derives breadcrumb from route context
 */
export function ResourceDetailHeader({
  title,
  actions,
  className,
}: ResourceDetailHeaderProps) {
  const { integrationId, resourceName } = useResourceRoute();
  const navigateWorkspace = useNavigateWorkspace();

  const formattedResourceName = resourceName
    ? formatResourceName(resourceName)
    : null;

  const handleBreadcrumbClick = () => {
    if (!integrationId || !resourceName) return;
    navigateWorkspace(`/rsc/${integrationId}/${resourceName}`);
  };

  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex items-center justify-between px-3 h-10 bg-sidebar border-b border-border shrink-0",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {formattedResourceName && (
          <>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={handleBreadcrumbClick}
              className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground shrink-0"
            >
              {formattedResourceName}
            </Button>
            <Icon
              name="chevron_right"
              className="text-muted-foreground shrink-0"
            />
          </>
        )}
        <h2 className="text-sm font-normal truncate">{title}</h2>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

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
