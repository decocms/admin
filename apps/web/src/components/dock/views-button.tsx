import { createPortal } from "react-dom";
import { Icon } from "@deco/ui/components/icon.tsx";
import { type ReactNode, type ReactPortal, useEffect, useMemo } from "react";
import { type Tab, togglePanel, useDock } from "./index.tsx";
import {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownTrigger,
} from "@deco/ui/components/responsive-dropdown.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

export const createPrependPortal = (
  component: ReactNode,
  container: Element,
): ReactPortal => {
  const portalContainer = document.createElement("div");

  useEffect(() => {
    container.prepend(portalContainer);
    return () => {
      container.removeChild(portalContainer);
    };
  }, [container, portalContainer]);

  return createPortal(
    component,
    portalContainer,
  );
};

// The order of this object's properties matters for sorting
const WELL_KNOWN_VIEW_ICONS = {
  "chat": "chat",
  "setup": "settings",
  "prompt": "assignment",
  "integrations": "linked_services",
  "triggers": "webhook",
  "audit": "forum",
  "usage": "monitoring",
};

function ViewsButtonInner(
  { tabs, openPanels }: { tabs: Record<string, Tab>; openPanels: Set<string> },
) {
  const all = Object.entries(tabs);
  const saved = all.filter(([_, tab]) => tab.metadata?.isSavedView);
  const views = all.filter(([_, tab]) =>
    !tab.metadata?.isSavedView && !tab.hideFromViews
  );

  // Sort views based on WELL_KNOWN_VIEW_ICONS order
  const sortedViews = views.sort(([idA], [idB]) => {
    const indexA = Object.keys(WELL_KNOWN_VIEW_ICONS).indexOf(idA);
    const indexB = Object.keys(WELL_KNOWN_VIEW_ICONS).indexOf(idB);
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return idA.localeCompare(idB);
  });

  return (
    <ResponsiveDropdown>
      <ResponsiveDropdownTrigger>
        <div className="w-8 h-8 hover:bg-background flex items-center justify-center cursor-pointer rounded-xl">
          <Icon name="layers" size={16} />
        </div>
      </ResponsiveDropdownTrigger>
      <ResponsiveDropdownContent align="start" className="p-2">
        <span className="p-1 text-xs text-muted-foreground font-medium">
          Views
        </span>
        {sortedViews.map(([id, tab]) => {
          const isActive = openPanels.has(id);

          return (
            <ResponsiveDropdownItem
              key={id}
              className={cn(
                "text-xs mb-1 rounded-lg",
                isActive && "bg-muted",
                "hover:bg-muted",
              )}
              onSelect={() => {
                togglePanel({ id, component: id, title: tab.title });
              }}
            >
              <Icon
                name={WELL_KNOWN_VIEW_ICONS[
                  id as keyof typeof WELL_KNOWN_VIEW_ICONS
                ] || "atr"}
                className="text-muted-foreground"
                size={16}
              />
              {tab.title}
            </ResponsiveDropdownItem>
          );
        })}
        <span className="p-1 text-xs text-muted-foreground font-medium">
          Saved
        </span>
        {saved.map(([id, tab]) => {
          const isActive = openPanels.has(id);

          return (
            <ResponsiveDropdownItem
              key={id}
              className={cn(
                "text-xs",
                isActive && "bg-muted",
                "hover:bg-muted",
              )}
              onSelect={() => {
                togglePanel({ id, component: id, title: tab.title });
              }}
            >
              {tab.title}
            </ResponsiveDropdownItem>
          );
        })}
      </ResponsiveDropdownContent>
    </ResponsiveDropdown>
  );
}

export function ViewsButton() {
  const { tabs, openPanels } = useDock();
  const containers = document.querySelectorAll(".dv-tabs-container");

  if (!containers || containers.length === 0) {
    return null;
  }

  const firstContainer = containers[0];

  return createPrependPortal(
    <div className="flex items-center justify-center w-9 h-8 pr-1">
      <ViewsButtonInner tabs={tabs} openPanels={openPanels} />
    </div>,
    firstContainer,
  );
}

ViewsButton.Styles = () => {
  return (
    <style>
      {`
        .dv-tabs-container {
          padding-top: 0.25rem;
          padding-left: 0.25rem;
          padding-right: 0.25rem;

      `}
    </style>
  );
};
