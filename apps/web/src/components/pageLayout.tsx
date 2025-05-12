import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { ComponentProps, ReactNode } from "react";

export interface PageProps {
  header?: ReactNode;
  main: ReactNode;
  footer?: ReactNode;
}

export const TabScrollArea = (
  { children, className, ...props }:
    & { children: ReactNode }
    & ComponentProps<typeof ScrollArea>,
) => (
  <ScrollArea
    className={cn(
      "h-full w-full p-6 text-slate-700",
      className,
    )}
    {...props}
  >
    {children}
  </ScrollArea>
);
