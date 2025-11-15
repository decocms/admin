import { Suspense, useMemo, type ReactNode } from "react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@deco/ui/components/alert.tsx";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { AuditListContent } from "../audit/list.tsx";
import { ResourceHeader } from "@deco/ui/components/resource-header.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";

function ActivityErrorFallback() {
  return (
    <Alert variant="destructive" className="my-8">
      <AlertTitle>Error loading activity</AlertTitle>
      <AlertDescription>
        Something went wrong while loading the activity data.
      </AlertDescription>
    </Alert>
  );
}

interface TabItem {
  id: string;
  label: string;
  onClick: () => void;
}

interface ActivitySettingsProps {
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  headerSlot?: ReactNode;
}

export default function ActivitySettings({
  tabs: propTabs,
  activeTab: propActiveTab,
  onTabChange,
  headerSlot,
}: ActivitySettingsProps = {}) {
  const navigateWorkspace = useNavigateWorkspace();

  // Use provided tabs or create default tabs with route navigation
  const mainTabs = useMemo(() => {
    if (propTabs) {
      return propTabs;
    }
    return [
      {
        id: "agents",
        label: "Agents",
        onClick: () => navigateWorkspace("/agents"),
      },
      {
        id: "threads",
        label: "Threads",
        onClick: () => navigateWorkspace("/agents/threads"),
      },
    ];
  }, [propTabs, navigateWorkspace]);

  // Use provided activeTab or default to "threads"
  const activeTab = propActiveTab ?? "threads";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto h-full">
        {/* Header Section - sticky horizontally */}
        <div className="sticky left-0 p-0 z-10 bg-background">
          <div className="max-w-[1600px] mx-auto w-full space-y-4 md:space-y-6 lg:space-y-8">
            {headerSlot}
            <ResourceHeader
              tabs={mainTabs}
              activeTab={activeTab}
              onTabChange={onTabChange}
            />
          </div>
        </div>

        {/* Content Section */}
        <div className="px-4 lg:px-6 xl:px-10 h-[calc(100%-168px)]">
          <div className="max-w-[1600px] mx-auto w-full pb-2 h-full">
            <ErrorBoundary fallback={<ActivityErrorFallback />}>
              <Suspense
                fallback={
                  <div className="flex justify-center items-center h-full py-8">
                    <Spinner />
                  </div>
                }
              >
                <AuditListContent />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
