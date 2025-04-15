import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useSidebar } from "@deco/ui/components/sidebar.tsx";
import { ReactNode } from "react";
import { TeamSelector } from "./sidebar/TeamSelector.tsx";

export interface PageProps {
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function MobileTopbar() {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="bg-slate-100 h-12 grid grid-cols-3 items-center w-full gap-4 md:hidden px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="w-8 h-8"
      >
        <Icon name="menu" weight={300} size={20} />
      </Button>
      <div className="flex justify-center">
        <TeamSelector />
      </div>
      <div />
    </div>
  );
}

/**
 * A layout component that creates a three-row layout with a fixed header, scrollable content area,
 * and an optional footer. The header and footer take only the space they need, while the content
 * area takes up the remaining space and becomes scrollable when content overflows.
 */
export function PageLayout({ header, children, footer }: PageProps) {
  return (
    <div className="h-full flex flex-col">
      <header className="w-full flex flex-col">
        <MobileTopbar />
        <div className="w-full flex items-center justify-between gap-4 px-4 py-2">
          {header}
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="px-4 py-2">
            {children}
          </div>
        </ScrollArea>
      </div>

      {footer && (
        <footer className="w-full px-4 py-2">
          {footer}
        </footer>
      )}
    </div>
  );
}
