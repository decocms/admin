import { useParams } from "@tanstack/react-router";
import { useCollection, useCollectionItem } from "../use-collections";
import { Workflow } from "@decocms/bindings/workflow";
import { createToolCaller, UNKNOWN_CONNECTION_ID } from "@/tools/client";

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
