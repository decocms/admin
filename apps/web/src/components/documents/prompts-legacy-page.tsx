import { lazy, Suspense, useMemo, useState } from "react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useLocation } from "react-router";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { ResourceHeader } from "../resources-v2/resource-header.tsx";

// Import the legacy prompts list component
const PromptsListLegacy = lazy(() => import("../prompts/list/list.tsx"));

export default function PromptsLegacyPage() {
  const location = useLocation();
  const navigateWorkspace = useNavigateWorkspace();
  const [viewMode, setViewMode] = useViewMode("prompts");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Determine active tab based on current route
  const activeTab = useMemo(() => {
    const pathname = location.pathname;
    if (pathname.includes("/documents/prompts")) return "prompts";
    return "all";
  }, [location.pathname]);

  const tabs = [
    {
      id: "all",
      label: "All",
      onClick: () => navigateWorkspace("/documents"),
    },
    {
      id: "prompts",
      label: "Prompts (Legacy)",
      onClick: () => navigateWorkspace("/documents/prompts"),
    },
  ];

  return (
    <div className="h-screen p-0 overflow-y-auto overflow-x-hidden">
      <div className="py-16 px-16 space-y-8">
        <div className="max-w-[1500px] mx-auto w-full space-y-8">
          <ResourceHeader
            title="Documents"
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(tabId) => {
              const tab = tabs.find((t) => t.id === tabId);
              if (tab?.onClick) {
                tab.onClick();
              }
            }}
            searchOpen={searchOpen}
            searchValue={searchValue}
            onSearchToggle={() => setSearchOpen(!searchOpen)}
            onSearchChange={setSearchValue}
            onSearchBlur={() => {
              if (!searchValue) {
                setSearchOpen(false);
              }
            }}
            onSearchKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Escape") {
                setSearchOpen(false);
              }
            }}
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
            <PromptsListLegacy searchTerm={searchValue} viewMode={viewMode} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
