import type { ReactNode } from "react";
import React, { useRef, useEffect } from "react";
import { cn } from "../lib/utils.ts";

interface DecoChatMessagesProps {
  children: ReactNode;
  className?: string;
  autoScroll?: boolean;
}

export function DecoChatMessages({
  children,
  className,
  autoScroll = true,
}: DecoChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const childrenCountRef = useRef(0);

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;

    // Count children to detect new messages
    const currentCount = React.Children.count(children);
    const hasNewChildren = currentCount > childrenCountRef.current;
    childrenCountRef.current = currentCount;

    if (hasNewChildren) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [children, autoScroll]);

  return (
    <div
      ref={scrollRef}
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
