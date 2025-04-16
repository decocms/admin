import { Button } from "@deco/ui/components/button.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  ComponentProps,
  ComponentType,
  createContext,
  ReactNode,
  use,
} from "react";
import Docked, { togglePanel, useDock } from "./dock/index.tsx";

export interface PageProps {
  header?: ReactNode;
  main: ReactNode;
  footer?: ReactNode;
}

/**
 * A layout component that creates a three-row layout with a fixed header, scrollable content area,
 * and an optional footer. The header and footer take only the space they need, while the content
 * area takes up the remaining space and becomes scrollable when content overflows.
 */
export function PageLayout({ header, main, footer }: PageProps) {
  return (
    <div className="h-full flex flex-col">
      {header && (
        <header className="w-full flex items-center justify-between gap-4 px-4 py-2">
          {header}
        </header>
      )}

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="px-4 py-2">
            {main}
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

interface MainViewProps {
  header?: ComponentType<unknown>;
  main: ComponentType<unknown>;
  footer?: ComponentType<unknown>;
}

export interface DockedPageProps {
  main: MainViewProps;
  tabs: Record<string, {
    Component: ComponentType<unknown>;
    initialOpen?: boolean;
  }>;
}

const Context = createContext<MainViewProps | null>(null);

function MainView() {
  const mainView = use(Context);

  if (!mainView) {
    return null;
  }

  const { header: Header, main: Main, footer: Footer } = mainView;

  return (
    <PageLayout
      header={Header && <Header />}
      main={<Main />}
      footer={Footer && <Footer />}
    />
  );
}

export function DockedPageLayout({ main, tabs }: DockedPageProps) {
  return (
    <Context.Provider value={main}>
      <Docked mainView={MainView} components={tabs} />
    </Context.Provider>
  );
}

export function DockedToggleButton(
  { id, title, children, className, ...btnProps }: {
    id: string;
    title: string;
    children: ReactNode;
  } & ComponentProps<typeof Button>,
) {
  const { openPanels, availablePanels } = useDock();

  return (
    <Button
      {...btnProps}
      disabled={!availablePanels.has(id)}
      onClick={() => togglePanel({ id, component: id, title })}
      className={cn(className, openPanels.has(id) ? "bg-accent" : "")}
    >
      {children}
    </Button>
  );
}
