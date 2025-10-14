import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { Suspense, useMemo, type ComponentType } from "react";
import { useLocation } from "react-router";
import { useSearchControls } from "../../hooks/use-search-controls.ts";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { type DecopilotContextValue } from "../decopilot/context.tsx";
import { DecopilotLayout } from "../layout/decopilot-layout.tsx";
import { ResourceHeader } from "../resources-v2/resource-header.tsx";

export interface TabConfig {
  id: string;
  label: string;
  path: string;
}

export interface TabbedPageLayoutProps {
  /** The component to render (must accept searchTerm and viewMode props) */
  component: ComponentType<{
    searchTerm: string;
    viewMode: "cards" | "table";
  }>;
  /** Page title shown in header */
  title: string;
  /** Tab configuration */
  tabs: TabConfig[];
  /** Function to determine active tab from pathname */
  getActiveTab: (pathname: string) => string;
  /** Optional view mode storage key (defaults to generic key) */
  viewModeKey?: string;
}

/**
 * Generic tabbed page layout for non-resource pages
 * Handles search, view mode, tabs, and page structure
 * Works for any custom list page (workflows/runs, documents/prompts, etc.)
 */
export function TabbedPageLayout({
  component: Component,
  title,
  tabs,
  getActiveTab,
  viewModeKey,
}: TabbedPageLayoutProps) {
  const location = useLocation();
  const navigateWorkspace = useNavigateWorkspace();
  const [viewMode, setViewMode] = useViewMode(viewModeKey);
  const searchControls = useSearchControls();

  // Determine active tab based on current route
  const activeTab = useMemo(
    () => getActiveTab(location.pathname),
    [location.pathname, getActiveTab],
  );

  // Build tabs with onClick handlers
  const tabsWithHandlers = useMemo(
    () =>
      tabs.map((tab) => ({
        ...tab,
        onClick: () => navigateWorkspace(tab.path),
      })),
    [tabs, navigateWorkspace],
  );

  const decopilotContextValue: DecopilotContextValue = useMemo(
    () => ({
      additionalTools: {},
    }),
    [],
  );

  return (
    <DecopilotLayout value={decopilotContextValue}>
      <div className="h-screen p-0 overflow-y-auto overflow-x-hidden">
        <div className="py-16 px-16 space-y-8">
          <div className="max-w-[1500px] mx-auto w-full space-y-8">
            <ResourceHeader
              title={title}
              tabs={tabsWithHandlers}
              activeTab={activeTab}
              onTabChange={(tabId) => {
                const tab = tabsWithHandlers.find((t) => t.id === tabId);
                tab?.onClick?.();
              }}
              searchOpen={searchControls.searchOpen}
              searchValue={searchControls.searchValue}
              onSearchToggle={searchControls.onSearchToggle}
              onSearchChange={searchControls.onSearchChange}
              onSearchBlur={searchControls.onSearchBlur}
              onSearchKeyDown={searchControls.onSearchKeyDown}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                </div>
              }
            >
              <Component
                searchTerm={searchControls.searchValue}
                viewMode={viewMode}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </DecopilotLayout>
  );
}
