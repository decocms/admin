import { useParams } from "@tanstack/react-router";
import { useCollection, useCollectionItem } from "../use-collections";
import {
  Workflow,
  WorkflowExecution,
  WorkflowExecutionStepResult,
} from "@decocms/bindings/workflow";
import { createToolCaller, UNKNOWN_CONNECTION_ID } from "@/tools/client";
import { useWorkflowBindingConnection } from "./use-workflow-binding-connection";
import { useToolCall } from "../use-tool-call";

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

export function useWorkflowExecutionCollectionItem(itemId: string) {
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
  const { data } = useToolCall({
    toolCaller: createToolCaller(connectionId),
    toolName: "COLLECTION_WORKFLOW_EXECUTION_GET",
    toolInputParams: {
      id: executionId,
    },
    enabled: !!executionId,
    refetchInterval: (query) => {
      const data = query.state?.data as {
        item:
          | (WorkflowExecution & {
              step_results: WorkflowExecutionStepResult[];
            })
          | null;
      };
      return data?.item?.completed_at_epoch_ms === null ? 1000 : 0;
    },
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
