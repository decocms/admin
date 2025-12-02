import { UNKNOWN_CONNECTION_ID } from "@/tools/client";
import { AgentDetailsView } from "@/web/components/details/agent.tsx";
import { ToolDetailsView } from "@/web/components/details/tool.tsx";
import { useCollection } from "@/web/hooks/use-collections";
import { EmptyState } from "@deco/ui/components/empty-state.tsx";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import type { ComponentType } from "react";

interface CollectionDetailsProps {
  itemId: string;
  onBack: () => void;
  onUpdate: (updates: Record<string, unknown>) => Promise<void>;
}

// Map of well-known views by collection name
const WELL_KNOWN_VIEW_DETAILS: Record<
  string,
  ComponentType<CollectionDetailsProps>
> = {
  agent: AgentDetailsView,
};

export default function CollectionDetails() {
  const params = useParams({
    strict: false,
  });

  const connectionId = params.connectionId;
  const collectionName = params.collectionName
    ? decodeURIComponent(params.collectionName)
    : undefined;
  const itemId = params.itemId ? decodeURIComponent(params.itemId) : undefined;

  // Use dynamic collection hook
  // collectionName can be "tools", "agents", etc.
  // We handle "tools" specially below, so we pass null to useCollection if it is tools
  // to avoid creating an invalid collection.
  const isTools = collectionName === "tools";

  const collection = useCollection(
    connectionId ?? UNKNOWN_CONNECTION_ID,
    !isTools && collectionName ? collectionName : "",
  );

  const handleBack = () => {
    window.history.back();
  };

  const handleUpdate = async (updates: Record<string, unknown>) => {
    if (!collection || !itemId) return;
    try {
      const tx = collection.update(itemId, (draft: Record<string, unknown>) => {
        // Apply updates to draft
        // Note: The draft structure depends on how the collection was defined and data shape.
        // For objects, Object.assign is usually fine if we want shallow merge.
        // We might need to handle nested updates if `updates` contains deep structures.
        Object.assign(draft, updates);
      });
      await tx.isPersisted.promise;
      toast.success("Item updated successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to update item: ${message}`);
      throw error;
    }
  };

  // Special handling for Tools - we might want to show the tool invocation UI here
  // For now, let's just show a placeholder or redirect back if we can't handle it yet
  if (isTools) {
    return (
      <ToolDetailsView
        itemId={itemId ?? ""}
        onBack={handleBack}
        onUpdate={handleUpdate}
      />
    );
  }

  // Check for well-known collections (case insensitive, singular/plural)
  const normalizedCollectionName = collectionName?.toLowerCase();

  const ViewComponent =
    normalizedCollectionName &&
    WELL_KNOWN_VIEW_DETAILS[normalizedCollectionName];

  if (ViewComponent) {
    return (
      <ViewComponent
        itemId={itemId ?? ""}
        onBack={handleBack}
        onUpdate={handleUpdate}
      />
    );
  }

  return (
    <EmptyState
      icon="extension"
      title="No component defined"
      description="No component for this collection was defined"
      buttonProps={{
        onClick: handleBack,
        children: "Go back",
      }}
    />
  );
}
