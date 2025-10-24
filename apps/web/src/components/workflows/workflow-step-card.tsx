import { Badge } from "@deco/ui/components/badge.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import ViewDetail from "../views/view-detail.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { useViewByUriV2 } from "@deco/sdk";

interface StepDurationProps {
  startTime?: string | null;
  endTime?: string | null;
  status?: string;
}

function formatDuration(milliseconds: number): string {
  const ms = milliseconds % 1000;
  const totalSeconds = Math.floor(milliseconds / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}.${ms.toString().padStart(3, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}.${ms.toString().padStart(3, "0")}s`;
  }
  return `${seconds}.${ms.toString().padStart(3, "0")}s`;
}

const StepDuration = memo(function StepDuration({
  startTime,
  endTime,
  status,
}: StepDurationProps) {
  const shouldSubscribe = status === "running" && startTime && !endTime;

  const timeRef = useRef(Date.now());

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!shouldSubscribe) return () => {};

      const interval = setInterval(() => {
        timeRef.current = Date.now();
        callback();
      }, 50);

      return () => clearInterval(interval);
    },
    [shouldSubscribe],
  );

  const getSnapshot = useCallback(() => {
    return shouldSubscribe ? timeRef.current : 0;
  }, [shouldSubscribe]);

  const currentTime = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot, // Server snapshot (same as client for time)
  );

  if (!startTime) return null;

  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : currentTime;
  const duration = Math.max(0, end - start);

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon name="schedule" size={14} />
      <span className="font-mono text-xs">{formatDuration(duration)}</span>
    </div>
  );
});

interface StepTimeInfoProps {
  startTime?: string | null;
  endTime?: string | null;
  status?: string;
}

export const StepTimeInfo = memo(function StepTimeInfo({
  startTime,
  endTime,
  status,
}: StepTimeInfoProps) {
  if (!startTime) return null;

  return (
    <div className="flex items-center gap-4 text-xs mt-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon name="play_arrow" size={14} />
        <span className="font-mono uppercase">
          {new Date(startTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      {endTime && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon name="check" size={14} />
          <span className="font-mono uppercase">
            {new Date(endTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      )}

      <StepDuration startTime={startTime} endTime={endTime} status={status} />
    </div>
  );
});

interface ViewDialogTriggerProps {
  resourceUri: string;
  output?: unknown;
}

export function ViewDialogTrigger({
  resourceUri,
  output,
}: ViewDialogTriggerProps) {
  const { data: resource, isLoading, error } = useViewByUriV2(resourceUri);
  const viewData = resource?.data;

  // Use view name, fallback to extracting from URI
  const viewName = useMemo(() => {
    if (viewData?.name) return viewData.name;

    // Extract name from URI as fallback: rsc://integration-id/resource-type/view-name
    try {
      const parts = resourceUri.replace("rsc://", "").split("/");
      const lastPart = parts[parts.length - 1];
      // Clean up the name: replace dashes with spaces, remove timestamp suffix
      return lastPart
        .replace(/-\d{4}-\d{2}-\d{2}T[\d-]+Z$/, "") // Remove timestamp
        .replace(/^Untitled$/, "Untitled View")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()); // Capitalize words
    } catch {
      return "View";
    }
  }, [viewData?.name, resourceUri]);

  if (isLoading) {
    return (
      <Badge variant="outline" className="cursor-wait">
        <Icon name="hourglass_empty" size={12} className="mr-1 animate-pulse" />
        Loading...
      </Badge>
    );
  }

  // Show view even if there's an error, just with fallback name
  const displayName = viewName || "View";
  const hasError = !!error || !viewData;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            hasError
              ? "border border-input bg-background hover:bg-muted"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          <Icon
            name={hasError ? "warning" : "visibility"}
            size={12}
            className="mr-1"
          />
          {displayName}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl w-[95vw] h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Icon name="view_list" size={20} className="text-primary" />
            {displayName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Interactive view preview
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-muted/30">
          <ViewDetail resourceUri={resourceUri} data={output} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
