import { Suspense, type ReactNode } from "react";
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

export default function ActivitySettings({
  headerSlot,
}: {
  headerSlot?: ReactNode;
} = {}) {
  const decopilotContextValue: DecopilotContextValue = {
    additionalTools: {},
  };

  return (
    <DecopilotLayout value={decopilotContextValue}>
      <div className="h-full w-full text-foreground flex flex-col p-4">
        {headerSlot}
        <ErrorBoundary fallback={<ActivityErrorFallback />}>
          <Suspense
            fallback={
              <div className="flex justify-center items-center h-64">
                <Spinner />
              </div>
            }
          >
            <div className="flex-1 min-h-0 overflow-hidden overflow-x-auto">
              <AuditListContent />
            </div>
          </Suspense>
        </ErrorBoundary>
      </div>
    </DecopilotLayout>
  );
}
