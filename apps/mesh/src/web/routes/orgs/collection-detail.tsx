import { UNKNOWN_CONNECTION_ID } from "@/tools/client";
import { AgentDetailsView } from "@/web/components/details/agent.tsx";
import { ToolDetailsView } from "@/web/components/details/tool.tsx";
import { useCollection, useCollectionItem } from "@/web/hooks/use-collections";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { EmptyState } from "@deco/ui/components/empty-state.tsx";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";

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

  const { data: item } = useCollectionItem(collection, itemId);

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

  // Simple loading check: if we have an ID but no item yet, and it's not tools
  const isLoading = !item && !isTools;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Special handling for Tools - we might want to show the tool invocation UI here
  // For now, let's just show a placeholder or redirect back if we can't handle it yet
  if (isTools) {
    return (
      <ToolDetailsView
        connectionId={connectionId ?? UNKNOWN_CONNECTION_ID}
        toolName={itemId ?? ""}
        onBack={handleBack}
      />
    );
  }

  // Check for well-known collections (case insensitive, singular/plural)
  const normalizedCollectionName = collectionName?.toLowerCase();

  // Map of well-known views by collection name
  const WellKnownViews: Record<
    string,
    React.ComponentType<{
      item: unknown;
      onBack: () => void;
      onUpdate: (updates: Record<string, unknown>) => Promise<void>;
    }>
  > = {
    agents: AgentDetailsView,
    agent: AgentDetailsView,
  };

  const ViewComponent =
    normalizedCollectionName && WellKnownViews[normalizedCollectionName];

  if (ViewComponent) {
    return (
      <ViewComponent item={item} onBack={handleBack} onUpdate={handleUpdate} />
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
