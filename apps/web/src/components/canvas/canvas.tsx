import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router";
import {
  type CanvasTab as CanvasTabType,
  useThreadManager,
} from "../decopilot/thread-context-manager.tsx";
import { CanvasTabContent } from "./canvas-tab-content.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import { usePinnedTabs } from "../../hooks/use-pinned-tabs.ts";

interface CanvasTabTriggerProps {
  tab: CanvasTabType;
  isActive: boolean;
  onClose: (e: React.MouseEvent) => void;
}

function CanvasTabTrigger({ tab, isActive, onClose }: CanvasTabTriggerProps) {
  const tabRef = useRef<HTMLButtonElement>(null);

  // Scroll into view when this tab becomes active
  useEffect(() => {
    if (isActive && tabRef.current) {
      tabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [isActive]);

  // Determine if this is an app tab (for proper icon rendering)
  const isAppTab = tab.resourceUri?.startsWith("app://");

  // Render icon based on type
  const renderIcon = () => {
    if (!tab.icon) return null;

    // For app tabs, use IntegrationIcon which handles URLs, file paths, and icon:// properly
    if (isAppTab) {
      return (
        <IntegrationIcon
          icon={tab.icon}
          name={tab.title}
          size="xs"
          className="!w-5 !h-5 shrink-0"
        />
      );
    }

    // For other tabs, check if it's a URL or an icon name
    if (tab.icon.startsWith("http") || tab.icon.startsWith("/")) {
      return <img src={tab.icon} alt="" className="size-5 rounded shrink-0" />;
    }

    // Default to Icon component for icon names
    return (
      <Icon
        name={tab.icon}
        size={20}
        className="text-muted-foreground shrink-0"
      />
    );
  };

  return (
    <TabsTrigger
      value={tab.id}
      variant="canvas"
      className="group relative pr-8 shrink-0"
      ref={tabRef}
    >
      {renderIcon()}
      <span className="truncate">{tab.title}</span>
      <div
        role="button"
        tabIndex={0}
        className="absolute rounded-full right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center cursor-pointer hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={onClose}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onClose(e as unknown as React.MouseEvent);
          }
        }}
      >
        <Icon name="close" size={12} />
      </div>
    </TabsTrigger>
  );
}

export function Canvas() {
  const { threads, activeThreadId, activeTabId, setActiveTab, removeTab } =
    useThreadManager();
  const { org, project } = useParams();
  const projectKey = org && project ? `${org}/${project}` : undefined;
  const { togglePin: togglePinnedTab, isPinned: isTabPinned } =
    usePinnedTabs(projectKey);

  // Get tabs from active thread (memoized to avoid unnecessary re-renders)
  const tabs = useMemo(() => {
    if (!activeThreadId) return [];
    const activeThread = threads[activeThreadId];
    return activeThread?.tabs || [];
  }, [threads, activeThreadId]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) || null,
    [tabs, activeTabId],
  );
  const isActiveTabPinned = activeTab
    ? isTabPinned(activeTab.resourceUri)
    : false;

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    // removeTab handles switching to another tab if needed
    removeTab(tabId);
  };

  const handleAddTab = () => {
    // Trigger the Cmd+K keyboard event to open the command palette
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  const handleToggleActiveTabPin = () => {
    if (!activeTab) return;

    togglePinnedTab({
      resourceUri: activeTab.resourceUri,
      title: activeTab.title,
      icon: activeTab.icon,
      type: activeTab.type,
    });
  };

  // Don't render content when no tabs, but keep the container
  if (tabs.length === 0) {
    return <div className="h-full flex flex-col bg-background" />;
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <Tabs
        value={activeTabId || undefined}
        onValueChange={setActiveTab}
        className="flex flex-col h-full gap-0"
      >
        {/* Canvas tab bar with new design */}
        <div className="shrink-0 flex h-10 bg-background">
          {/* + Button */}
          <button
            type="button"
            onClick={handleAddTab}
            className="flex items-center justify-center h-full w-10 border-r border-b border-border shrink-0 hover:bg-accent transition-colors text-muted-foreground"
          >
            <Icon name="add" size={20} />
          </button>

          {/* Tab triggers - scrollable area */}
          <div className="flex-1 min-w-0 flex h-full overflow-x-auto no-scrollbar">
            <TabsList variant="canvas" className="border-0 flex-none">
              {tabs.map((tab) => (
                <CanvasTabTrigger
                  key={tab.id}
                  tab={tab}
                  isActive={activeTabId === tab.id}
                  onClose={(e) => handleCloseTab(e, tab.id)}
                />
              ))}
            </TabsList>

            {/* Filler to complete the border line */}
            <div className="flex-1 border-l border-b border-border" />
          </div>

          {/* Action buttons slot - portal target for detail views */}
          <div className="flex items-center gap-2 px-3 border-l border-border h-full">
            {activeTab && (
              <button
                type="button"
                onClick={handleToggleActiveTabPin}
                className="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                title={isActiveTabPinned ? "Unpin tab" : "Pin tab"}
                aria-label={isActiveTabPinned ? "Unpin tab" : "Pin tab"}
                aria-pressed={isActiveTabPinned}
              >
                <Icon
                  name={isActiveTabPinned ? "keep_off" : "keep"}
                  size={16}
                  className={
                    isActiveTabPinned
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                />
              </button>
            )}
            <div
              id="canvas-tab-actions-portal"
              className="flex items-center gap-2 h-full empty:hidden"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="h-full m-0">
              <CanvasTabContent tab={tab} />
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
