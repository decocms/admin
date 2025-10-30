import { Badge } from "@deco/ui/components/badge.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useMemo } from "react";
import ViewDetail from "../views/view-detail.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { useViewByUriV2 } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";

interface ViewDialogTriggerProps {
  resourceUri: string;
  output?: unknown;
}

export function ViewDialogTrigger({
  resourceUri,
  output,
}: ViewDialogTriggerProps) {
  const { data: resource, isLoading, error } = useViewByUriV2(resourceUri);
  const viewData = resource?.data;

  // Use view name, fallback to extracting from URI
  const viewName = useMemo(() => {
    if (viewData?.name) return viewData.name;

    // Extract name from URI as fallback: rsc://integration-id/resource-type/view-name
    try {
      const parts = resourceUri.replace("rsc://", "").split("/");
      const lastPart = parts[parts.length - 1];
      // Clean up the name: replace dashes with spaces, remove timestamp suffix
      return lastPart
        .replace(/-\d{4}-\d{2}-\d{2}T[\d-]+Z$/, "") // Remove timestamp
        .replace(/^Untitled$/, "Untitled View")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()); // Capitalize words
    } catch {
      return "View";
    }
  }, [viewData?.name, resourceUri]);

  if (isLoading) {
    return (
      <Badge variant="outline" className="cursor-wait">
        <Icon name="hourglass_empty" size={12} className="mr-1 animate-pulse" />
        Loading...
      </Badge>
    );
  }

  // Show view even if there's an error, just with fallback name
  const displayName = viewName || "View";
  const hasError = !!error || !viewData;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="text-xs">
          <Icon
            name={hasError ? "warning" : "visibility"}
            size={12}
            className="mr-1"
          />
          {displayName}
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-[95vw] h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Icon name="view_list" size={20} className="text-primary" />
            {displayName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Interactive view preview
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-muted/30">
          <ViewDetail resourceUri={resourceUri} data={output} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
