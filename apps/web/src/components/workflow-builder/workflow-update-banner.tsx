import { startTransition, useState } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  usePendingServerUpdate,
  useIsDirty,
  useWorkflowActions,
} from "../../stores/workflows/hooks.ts";

/**
 * Banner that shows when there's a pending workflow update requiring user action
 * Only renders when pendingServerUpdate is not null
 */
export function WorkflowUpdateBanner() {
  const pendingUpdate = usePendingServerUpdate();
  const isDirty = useIsDirty();
  const { acceptPendingUpdate, dismissPendingUpdate } = useWorkflowActions();
  const [isAccepting, setIsAccepting] = useState(false);

  if (!pendingUpdate) return null;

  const handleAccept = () => {
    setIsAccepting(true);
    startTransition(() => {
      acceptPendingUpdate();
      setTimeout(() => setIsAccepting(false), 0);
    });
  };

  const handleDismiss = () => {
    startTransition(() => {
      dismissPendingUpdate();
    });
  };

  return (
    <div className="mb-4 relative overflow-hidden rounded-lg border border-warning/20 bg-warning/5 backdrop-blur-sm shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="absolute inset-0 bg-gradient-to-r from-warning/10 via-transparent to-warning/10 pointer-events-none" />
      <div className="relative p-3.5 flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className="relative">
            <div className="absolute inset-0 bg-warning/20 rounded-full blur-sm animate-pulse" />
            <Icon
              name="sync"
              className="relative text-warning animate-[spin_3s_ease-in-out_infinite]"
              size={18}
            />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground/90 leading-relaxed">
            {isDirty ? (
              <>
                Workflow updated externally.{" "}
                <span className="text-destructive font-medium">
                  Accepting will discard your changes.
                </span>
              </>
            ) : (
              <>A newer version is available.</>
            )}
          </p>
          <div className="flex flex-wrap gap-2 mt-2.5">
            <Button
              size="sm"
              onClick={handleAccept}
              variant={isDirty ? "destructive" : "default"}
              disabled={isAccepting}
              className="h-7 text-xs px-3"
            >
              {isAccepting ? (
                <>
                  <Icon name="sync" className="mr-1.5 animate-spin" size={12} />
                  Updating...
                </>
              ) : (
                <>Update{isDirty && " & Discard"}</>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-7 text-xs px-3 text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
