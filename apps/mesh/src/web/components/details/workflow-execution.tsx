import { UNKNOWN_CONNECTION_ID } from "@/tools/client";
import {
  useCollection,
  useCollectionItem,
  useCollectionList,
  useFilteredCollection,
} from "@/web/hooks/use-collections";
import { Spinner } from "@deco/ui/components/spinner.js";
import {
  WorkflowExecution,
  WorkflowExecutionStepResult,
} from "@decocms/bindings/workflow";
import { useParams } from "@tanstack/react-router";
import { ViewLayout, ViewTabs } from "./layout";
import { Button } from "@deco/ui/components/button.js";
import { useMemo } from "react";
import { ExecutionResult } from "./tool";
import { Badge } from "@deco/ui/components/badge.js";

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
  const stepResultsWhere = useMemo(
    () => ({
      field: ["execution_id"],
      operator: "eq" as const,
      value: itemId,
    }),
    [itemId],
  );

  // Get step results collection with server-side filter
  // This creates a unique collection that syncs only step results for this execution
  const stepResultsCollection =
    useFilteredCollection<WorkflowExecutionStepResult>(
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
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-medium">{execution.title}</h2>
            <Badge variant="outline">{execution.status}</Badge>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-medium mb-2">Execution Input</h3>
            <ExecutionResult
              executionResult={
                Object.keys(execution.input ?? {}).length > 0
                  ? (execution.input ?? null)
                  : null
              }
              placeholder="No execution input found"
            />
            <h3 className="text-lg font-medium mb-2">
              Step Results ({stepResults?.length ?? 0})
            </h3>
            {stepResults.map((stepResult) => (
              <ExecutionResult
                key={stepResult.id}
                executionResult={stepResult}
                placeholder="No step results found"
              />
            ))}
          </div>
        </div>
      </div>
    </ViewLayout>
  );
}
