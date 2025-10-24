import { Icon } from "@deco/ui/components/icon.tsx";
import { memo, useCallback, useRef, useSyncExternalStore } from "react";

interface StepFooterProps {
  startTime?: string | null;
  endTime?: string | null;
  status?: string;
  cost?: number | null;
}

function formatTime(timestamp: string | null | undefined): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  const totalSeconds = milliseconds / 1000;
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds.toFixed(3)}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toFixed(3)}s`;
  }
  return `${seconds.toFixed(3)}s`;
}

function formatCost(cost: number | null | undefined): string {
  if (cost === null || cost === undefined) return "-";
  return `$${cost.toFixed(4)}`;
}

export const StepFooter = memo(function StepFooter({
  startTime,
  endTime,
  status,
  cost,
}: StepFooterProps) {
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

  const currentTime = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Early return AFTER all hooks
  if (!startTime && !endTime && !cost) return null;

  // Calculate duration in real-time (directly in render, NOT in useMemo!)
  let duration: number | null = null;
  if (startTime) {
    const start = new Date(startTime).getTime();
    if (endTime) {
      // If endTime exists, use it
      const end = new Date(endTime).getTime();
      duration = Math.max(0, end - start);
    } else if (shouldSubscribe) {
      // If no endTime but step is running, use currentTime for live duration
      duration = Math.max(0, currentTime - start);
    }
    // Otherwise duration remains null (shows "-")
  }

  return (
    <div className="px-4 pt-2 pb-1 flex items-center gap-3 text-xs text-muted-foreground font-mono leading-none min-w-0 overflow-x-auto">
      {/* Start and End Times */}
      {startTime && (
        <>
          <div className="flex items-center gap-1.5 shrink-0">
            <Icon name="play_arrow" size={14} className="shrink-0" />
            <span className="whitespace-nowrap">{formatTime(startTime)}</span>
            <span>-</span>
            <span className="whitespace-nowrap">{formatTime(endTime)}</span>
          </div>

          {/* Divider */}
          <div className="h-3.5 w-px bg-muted-foreground/30 shrink-0" />

          {/* Duration (real-time for running steps) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Icon name="schedule" size={14} className="shrink-0" />
            <span className="whitespace-nowrap">
              {duration !== null ? formatDuration(duration) : "-"}
            </span>
          </div>
        </>
      )}

      {cost !== null && cost !== undefined && (
        <>
          {/* Divider */}
          {startTime && (
            <div className="h-3.5 w-px bg-muted-foreground/30 shrink-0" />
          )}

          {/* Cost */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Icon name="payments" size={14} className="shrink-0" />
            <span className="whitespace-nowrap">{formatCost(cost)}</span>
          </div>
        </>
      )}
    </div>
  );
});
