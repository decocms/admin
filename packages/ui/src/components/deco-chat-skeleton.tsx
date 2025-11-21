import { cn } from "../lib/utils.ts";

export function DecoChatSkeleton() {
  return (
    <div className="flex h-full w-full flex-col bg-sidebar">
      {/* Header skeleton */}
      <div className="flex-none border-b border-border/80 px-5 pb-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Avatar skeleton */}
            <div className="size-10 rounded-xl bg-muted animate-pulse" />
            <div className="flex flex-col gap-2">
              {/* Title skeleton */}
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              {/* Subtitle skeleton */}
              <div className="h-3 w-32 rounded bg-muted/60 animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Badge skeleton */}
            <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
            {/* Model selector skeleton */}
            <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
          </div>
        </div>
      </div>

      {/* Messages area skeleton */}
      <div className="flex-1 overflow-hidden px-4 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {/* Example message bubbles */}
          <MessageSkeleton align="right" width="w-3/4" />
          <MessageSkeleton align="left" width="w-full" lines={3} />
          <MessageSkeleton align="right" width="w-2/3" />
          <MessageSkeleton align="left" width="w-5/6" lines={2} />
        </div>
      </div>

      {/* Input area skeleton */}
      <div className="flex-none border-t border-border/80 px-5 py-4">
        <div className="space-y-3">
          {/* Input box skeleton */}
          <div className="relative flex min-h-[130px] flex-col rounded-xl border border-border bg-background shadow-sm">
            <div className="relative flex flex-1 flex-col gap-2 p-2.5">
              <div className="relative flex-1">
                {/* Text area lines */}
                <div className="space-y-2 p-2">
                  <div className="h-3 w-full rounded bg-muted/40 animate-pulse" />
                  <div className="h-3 w-4/5 rounded bg-muted/40 animate-pulse" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-2.5 pb-2.5">
              <div className="flex items-center gap-1">
                {/* Left button skeleton */}
                <div className="size-8 rounded-full bg-muted/60 animate-pulse" />
              </div>
              <div className="flex items-center gap-1">
                {/* Right actions skeleton */}
                <div className="h-8 w-32 rounded-lg bg-muted/60 animate-pulse" />
                <div className="size-8 rounded-full bg-muted animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MessageSkeletonProps {
  align: "left" | "right";
  width?: string;
  lines?: number;
}

function MessageSkeleton({
  align,
  width = "w-full",
  lines = 1,
}: MessageSkeletonProps) {
  return (
    <div
      className={cn(
        "flex w-full gap-4 px-4 py-2",
        align === "right" ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col gap-2",
          align === "right"
            ? "ml-auto max-w-3/4 items-end"
            : "w-full items-start",
        )}
      >
        {/* Timestamp skeleton */}
        <div className="h-3 w-16 rounded bg-muted/40 animate-pulse" />

        {/* Message content skeleton */}
        <div
          className={cn(
            "min-w-0 rounded-2xl p-4",
            align === "right"
              ? "bg-muted"
              : "bg-transparent border border-border/40",
            width,
          )}
        >
          <div className="space-y-2">
            {Array.from({ length: lines }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-3 rounded bg-muted-foreground/20 animate-pulse",
                  i === lines - 1 ? "w-3/4" : "w-full",
                )}
                style={{
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
