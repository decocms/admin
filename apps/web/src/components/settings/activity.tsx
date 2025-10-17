import { Suspense, useMemo } from "react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@deco/ui/components/alert.tsx";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { AuditListContent } from "../audit/list.tsx";
import { type DecopilotContextValue } from "../decopilot/context.tsx";
import { DecopilotLayout } from "../layout/decopilot-layout.tsx";
import { ResourceHeader } from "../resources-v2/resource-header.tsx";
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

export default function ActivitySettings() {
  const navigateWorkspace = useNavigateWorkspace();
  const decopilotContextValue: DecopilotContextValue = {
    additionalTools: {},
  };

  const mainTabs = useMemo(() => {
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
  }, [navigateWorkspace]);

  return (
    <DecopilotLayout value={decopilotContextValue}>
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {/* Header Section - sticky horizontally */}
          <div className="sticky left-0 px-4 lg:px-6 xl:px-10 pt-12 pb-4 md:pb-6 lg:pb-8 z-10 bg-background">
            <div className="max-w-[1600px] mx-auto w-full">
              <ResourceHeader
                title="Threads"
                tabs={mainTabs}
                activeTab="threads"
              />
            </div>
          </div>

          {/* Content Section */}
          <div className="px-4 lg:px-6 xl:px-10">
            <div className="max-w-[1600px] mx-auto w-full pb-8">
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
    </DecopilotLayout>
  );
}
