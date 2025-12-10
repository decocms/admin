import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  getOrganizationSettingsCollection,
  useOrganizationSettings,
} from "../hooks/collections/use-organization-settings";
import { useProjectContext } from "../providers/project-context-provider";

interface PinToSidebarButtonProps {
  connectionId: string;
  title: string;
}

/**
 * Reusable button component for pinning/unpinning views to the sidebar
 */
export function PinToSidebarButton({
  connectionId,
  title,
}: PinToSidebarButtonProps) {
  const routerState = useRouterState();
  const url = routerState.location.href;
  const { org } = useProjectContext();
  const settings = useOrganizationSettings(org.id);
  const collection = getOrganizationSettingsCollection(org.id);

  const isPinned = !!settings?.sidebar_items?.some((item) => item.url === url);

  const handleTogglePin = () => {
    const currentItems = settings?.sidebar_items || [];
    let updatedItems: typeof currentItems;

    if (isPinned) {
      // Unpin: delete the item
      updatedItems = currentItems.filter((item) => item.url !== url);
    } else {
      // Insert new item
      updatedItems = [...currentItems, { title, url, connectionId }];
    }

    const tx = collection.update(org.id, (draft) => {
      draft.sidebar_items = updatedItems;
    });
    tx.isPersisted.promise.catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to ${isPinned ? "unpin" : "pin"} view: ${message}`);
    });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleTogglePin}
            size="icon"
            variant={isPinned ? "secondary" : "outline"}
            className="size-8 border border-input"
          >
            <Icon name="keep" size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isPinned ? "Pinned" : "Pin to sidebar"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
