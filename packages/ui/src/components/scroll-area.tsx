"use client";

import type * as React from "react";
import { forwardRef } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@deco/ui/lib/utils.ts";

const ScrollArea = forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    hideScrollbar?: boolean;
    contentClassName?: string;
    onScroll?: React.UIEventHandler<HTMLDivElement>;
  }
>(
  (
    {
      className,
      contentClassName,
      children,
      hideScrollbar = false,
      onScroll,
      ...props
    },
    ref,
  ) => {
    return (
      <ScrollAreaPrimitive.Root
        data-slot="scroll-area"
        className={cn("relative h-full w-full", className)}
        {...props}
      >
        <ScrollAreaPrimitive.Viewport
          ref={ref}
          onScroll={onScroll}
          data-slot="scroll-area-viewport"
          className="h-full w-full overflow-auto rounded-[inherit] outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <div className={cn("flex min-w-0 flex-col", contentClassName)}>
            {children}
          </div>
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar className={cn(hideScrollbar && "hidden")} />
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    );
  },
);

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> & {
  orientation?: "vertical" | "horizontal";
}) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "select-none touch-none p-px transition-colors hidden",
        orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent",
        className,
        "border-l border-l-transparent invisible bg-transparent",
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-transparent"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
