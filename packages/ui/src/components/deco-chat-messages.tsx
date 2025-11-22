import type { ReactNode } from "react";
import { cn } from "../lib/utils.ts";

interface DecoChatMessagesProps {
  children: ReactNode;
  className?: string;
}

export function DecoChatMessages({
  children,
  className,
}: DecoChatMessagesProps) {
  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden",
        className,
      )}
    >
      <div className="flex flex-col gap-4 min-w-0 max-w-2xl mx-auto w-full py-4">
        {children}
      </div>
    </div>
  );
}
