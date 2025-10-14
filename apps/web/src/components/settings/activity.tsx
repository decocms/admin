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
      <div className="h-screen flex flex-col overflow-hidden">
        <div className="flex-shrink-0 pt-4 px-4 md:pt-8 md:px-8 lg:pt-16 lg:px-16 pb-4">
          <div className="max-w-[1500px] mx-auto w-full">
            <ResourceHeader
              title="Threads"
              tabs={mainTabs}
              activeTab="threads"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 px-4 md:px-8 lg:px-16 pb-4 md:pb-8 lg:pb-16">
          <ErrorBoundary fallback={<ActivityErrorFallback />}>
            <Suspense
              fallback={
                <div className="flex justify-center items-center h-full">
                  <Spinner />
                </div>
              }
            >
              <AuditListContent />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </DecopilotLayout>
  );
}
