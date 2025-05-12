import { Button } from "@deco/ui/components/button.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { ComponentProps, ReactNode } from "react";
import { togglePanel, useDock } from "./dock/index.tsx";

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

export function DockedToggleButton(
  { id, title, children, className, disabled, ...btnProps }: {
    id: string;
    title: string;
    children: ReactNode;
  } & ComponentProps<typeof Button>,
) {
  const { openPanels, tabs } = useDock();

  return (
    <Button
      {...btnProps}
      type="button"
      disabled={disabled || !tabs[id]}
      onClick={() =>
        togglePanel({
          id,
          component: id,
          title,
          initialWidth: 420,
          position: { direction: "right" },
        })}
      className={cn(className, openPanels.has(id) ? "bg-accent" : "")}
    >
      {children}
    </Button>
  );
}
