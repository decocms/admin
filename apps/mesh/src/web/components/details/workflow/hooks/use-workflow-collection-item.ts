import { useParams } from "@tanstack/react-router";
import {
  CollectionFilter,
  useCollection,
  useCollectionItem,
  useCollectionList,
} from "@/web/hooks/use-collections";
import {
  Workflow,
  WorkflowExecution,
  WorkflowExecutionStepResult,
} from "@decocms/bindings/workflow";
import { createToolCaller, UNKNOWN_CONNECTION_ID } from "@/tools/client";
import { useWorkflowBindingConnection } from "./use-workflow-binding-connection";
import { useToolCall } from "@/web/hooks/use-tool-call";

export function useWorkflowCollectionItem(itemId: string) {
  const { connectionId } = useParams({
    strict: false,
  });
  const toolCaller = createToolCaller(connectionId ?? UNKNOWN_CONNECTION_ID);
  const collection = useCollection<Workflow>(
    connectionId ?? UNKNOWN_CONNECTION_ID,
    "workflow",
    toolCaller,
  );
  const item = useCollectionItem<Workflow>(collection, itemId);
  return {
    item,
    update: (updates: Record<string, unknown>) => {
      collection.update(itemId, (draft) => {
        Object.assign(draft, updates);
      });
    },
  };
}

export function useWorkflowExecutionCollectionList({
  workflowId,
}: {
  workflowId?: string;
}) {
  const { connectionId } = useParams({
    strict: false,
  });
  const toolCaller = createToolCaller(connectionId ?? UNKNOWN_CONNECTION_ID);
  const collection = useCollection<WorkflowExecution>(
    connectionId ?? UNKNOWN_CONNECTION_ID,
    "workflow_execution",
    toolCaller,
  );

  const list = useCollectionList(collection, {
    maxItems: 10,
    sortKey: "created_at",
    sortDirection: "desc",
    filters: [
      workflowId
        ? {
            column: "workflow_id",
            value: workflowId,
          }
        : undefined,
    ].filter(Boolean) as CollectionFilter[],
  });
  return {
    list,
  };
}

export function useWorkflowExecutionCollectionItem(itemId?: string) {
  const { connectionId } = useParams({
    strict: false,
  });
  const toolCaller = createToolCaller(connectionId ?? UNKNOWN_CONNECTION_ID);
  const collection = useCollection<WorkflowExecution>(
    connectionId ?? UNKNOWN_CONNECTION_ID,
    "workflow_execution",
    toolCaller,
  );
  const item = useCollectionItem<WorkflowExecution>(collection, itemId);
  return {
    item,
  };
}

function useWorkflowGetExecutionStepResultTool() {
  const connection = useWorkflowBindingConnection();
  const stepResultsGetTool = connection.tools?.find(
    (tool) => tool.name === "COLLECTION_EXECUTION_STEP_RESULTS_GET",
  );
  if (!stepResultsGetTool) {
    throw new Error("COLLECTION_EXECUTION_STEP_RESULTS_GET tool not found");
  }
  return {
    tool: stepResultsGetTool,
    connectionId: connection.id,
  };
}

export function usePollingWorkflowExecution(executionId?: string) {
  const { connectionId } = useWorkflowGetExecutionStepResultTool();
  const toolCaller = createToolCaller(connectionId);
  const collection = useCollection<WorkflowExecution>(
    connectionId ?? UNKNOWN_CONNECTION_ID,
    "workflow_execution",
    toolCaller,
  );

  const existingExecution = useWorkflowExecutionCollectionItem(executionId);

  const { data } = useToolCall({
    toolCaller: toolCaller,
    toolName: "COLLECTION_WORKFLOW_EXECUTION_GET",
    toolInputParams: {
      id: executionId,
    },
    enabled: !!executionId,
    refetchInterval: executionId
      ? (query) => {
          const completedAtEpochMs =
            existingExecution?.item?.completed_at_epoch_ms;
          const status = existingExecution?.item?.status;
          const item = (query.state?.data as { item: WorkflowExecution | null })
            ?.item;
          const id = item?.id;
          if (
            (id && completedAtEpochMs !== null) ||
            (status === "error" &&
              (query.state?.data as { item: WorkflowExecution | null })?.item &&
              id === executionId)
          ) {
            collection.utils.writeUpdate([
              {
                id,
                title: item?.title ?? "",
                created_at: item?.created_at ?? "",
                updated_at: item?.updated_at ?? "",
                status: item?.status ?? "enqueued",
                workflow_id: item?.workflow_id ?? "",
                description: item?.description ?? "",
                deadline_at_epoch_ms: item?.deadline_at_epoch_ms ?? undefined,
                start_at_epoch_ms: item?.start_at_epoch_ms ?? undefined,
                timeout_ms: item?.timeout_ms ?? undefined,
                completed_at_epoch_ms: completedAtEpochMs,
              },
            ]);
          }
          return item?.completed_at_epoch_ms === null ? 1000 : false;
        }
      : false,
  }) as {
    data: {
      item:
        | (WorkflowExecution & { step_results: WorkflowExecutionStepResult[] })
        | null;
    };
  };

  return {
    item: data?.item,
  };
}
