import { UNKNOWN_CONNECTION_ID } from "@/tools/client";
import { AgentDetailsView } from "@/web/components/views/agent-details-view.tsx";
import { useConnection } from "@/web/hooks/collections/use-connection";
import { useCollection, useCollectionItem } from "@/web/hooks/use-collections";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function McpItemDetails() {
  const { connectionId, collectionName, itemId } = useParams({
    strict: false,
  });

  const { data: connection } = useConnection(connectionId);

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

  const handleUpdate = async (updates: Record<string, any>) => {
    if (!collection || !itemId) return;
    try {
      const tx = collection.update(itemId, (draft: any) => {
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
      <div className="container max-w-4xl py-6">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Tool: {itemId}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Tool invocation interface will be implemented here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check for well-known collections (case insensitive, singular/plural)
  const normalizedCollectionName = collectionName?.toLowerCase();

  // Map of well-known views by collection name
  const WellKnownViews: Record<
    string,
    React.ComponentType<{
      item: any;
      onBack: () => void;
      onUpdate: (updates: Record<string, any>) => Promise<void>;
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
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {item?.title || itemId}
          </h1>
          <p className="text-muted-foreground">
            {collectionName} • {connection?.title}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] w-full rounded-md border p-4">
            <pre className="text-sm font-mono">
              {JSON.stringify(item, null, 2)}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
