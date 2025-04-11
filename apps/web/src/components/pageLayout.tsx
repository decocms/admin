import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { ReactNode } from "react";

export interface PageProps {
  topbar: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * A layout component that creates a three-row layout with a fixed header, scrollable content area,
 * and an optional footer. The header and footer take only the space they need, while the content
 * area takes up the remaining space and becomes scrollable when content overflows.
 */
export function PageLayout({ topbar, children, footer }: PageProps) {
  return (
    <div className="h-full flex flex-col">
      <header className="w-full flex items-center justify-between gap-4 px-4 py-2">
        {topbar}
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
