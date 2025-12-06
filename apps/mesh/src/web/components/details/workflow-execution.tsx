import { UNKNOWN_CONNECTION_ID } from "@/tools/client";
import { useCollection, useCollectionItem, useCollectionList, useFilteredCollection } from "@/web/hooks/use-collections";
import { Spinner } from "@deco/ui/components/spinner.js";
import { WorkflowExecution, WorkflowExecutionStepResult } from "@decocms/bindings/workflow";
import { useParams } from "@tanstack/react-router";
import { ViewLayout, ViewTabs } from "./layout";
import { Button } from "@deco/ui/components/button.js";
import { useMemo } from "react";

export interface WorkflowExecutionDetailsViewProps {
  itemId: string;
  onBack: () => void;
  onUpdate: (updates: Record<string, unknown>) => Promise<void>;
}

export function WorkflowExecutionDetailsView({
  itemId,
  onBack,
}: WorkflowExecutionDetailsViewProps) {
  const { connectionId } = useParams({
    strict: false,
  });

  // Get execution collection
  const executionCollection = useCollection<WorkflowExecution>(
    connectionId ?? UNKNOWN_CONNECTION_ID,
    "execution",
  );

  // Get the execution by ID
  const execution = useCollectionItem(executionCollection, itemId);

  // Create server-side filter for step results
  const stepResultsWhere = useMemo(() => ({
    field: ["execution_id"],
    operator: "eq" as const,
    value: itemId,
  }), [itemId]);

  // Get step results collection with server-side filter
  // This creates a unique collection that syncs only step results for this execution
  const stepResultsCollection = useFilteredCollection<WorkflowExecutionStepResult>(
    connectionId ?? UNKNOWN_CONNECTION_ID,
    "execution_step_results",
    { where: stepResultsWhere },
  );

  // Get all step results from the filtered collection
  const stepResults = useCollectionList(stepResultsCollection, {
    sortKey: "created_at",
    sortDirection: "asc",
  });

  if (!execution) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <ViewLayout onBack={onBack}>
      <ViewTabs>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 bg-muted text-foreground font-normal"
        >
          Steps
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-muted-foreground font-normal"
          disabled={true}
        >
          Triggers
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-muted-foreground font-normal"
          disabled={true}
        >
          Advanced
        </Button>
      </ViewTabs>

      {/* Main Content */}
      <div className="p-5">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Execution</h3>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(execution, null, 2)}
            </pre>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-2">Step Results ({stepResults?.length ?? 0})</h3>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(stepResults, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </ViewLayout>
  );
}
