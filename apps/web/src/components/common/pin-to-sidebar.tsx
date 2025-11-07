import { buildDocumentUri, buildWorkflowUri } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useParams } from "react-router";
import type { CustomRowAction } from "../resources-v2/list.tsx";
import {
  usePinnedTabs,
  type PinnedTabInput,
} from "../../hooks/use-pinned-tabs.ts";

interface PinToSidebarProps {
  resourceId: string;
  resourceName: string;
  resourceType: "agent" | "document" | "workflow" | "view";
  integrationId?: string;
  icon?: string;
}

/**
 * Build the appropriate resourceUri based on resource type
 */
function buildResourceUriForType(
  resourceType: string,
  resourceId: string,
  integrationId?: string,
): string {
  switch (resourceType) {
    case "document":
      return buildDocumentUri(resourceId);
    case "workflow":
      return buildWorkflowUri(resourceId);
    case "agent":
      // For agents, we need a threadId but we don't have it here
      // We'll use a placeholder that will be handled by the agent view
      return `agent://${resourceId}/new`;
    case "view":
      // For views, use the generic resource URI format
      if (integrationId) {
        return `view://${integrationId}/${resourceId}`;
      }
      return `view://custom/${resourceId}`;
    default:
      // Fallback to generic resource URI
      if (integrationId) {
        return `rsc://${integrationId}/${resourceType}/${resourceId}`;
      }
      return `rsc://unknown/${resourceType}/${resourceId}`;
  }
}

export function PinToSidebarButton({
  resourceId,
  resourceName,
  resourceType,
  integrationId,
  icon,
}: PinToSidebarProps) {
  const { org, project } = useParams();
  const projectKey = org && project ? `${org}/${project}` : undefined;
  const { togglePin, isPinned } = usePinnedTabs(projectKey);

  const resourceUri = buildResourceUriForType(
    resourceType,
    resourceId,
    integrationId,
  );
  const isPinnedToSidebar = isPinned(resourceUri);

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();

    const tabData: PinnedTabInput = {
      resourceUri,
      title: resourceName,
      type: "detail", // Resource pins are always detail views
      icon: icon?.toLowerCase(),
    };

    togglePin(tabData);

    const typeLabel =
      resourceType === "agent"
        ? "Agent"
        : resourceType === "document"
          ? "Document"
          : resourceType === "workflow"
            ? "Workflow"
            : "View";

    if (isPinnedToSidebar) {
      toast.success(`${typeLabel} "${resourceName}" unpinned from sidebar`);
    } else {
      toast.success(`${typeLabel} "${resourceName}" pinned to sidebar`);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleTogglePin}
      title={isPinnedToSidebar ? "Unpin from sidebar" : "Pin to sidebar"}
    >
      <Icon
        name={isPinnedToSidebar ? "keep_off" : "keep"}
        size={14}
        className={isPinnedToSidebar ? "" : "opacity-50"}
      />
    </Button>
  );
}

/**
 * Create a pin action for customRowActions
 * This is a regular function (not a hook) that can be called from adapter functions
 */
export function createPinAction(
  resourceId: string,
  resourceName: string,
  resourceType: "agent" | "document" | "workflow" | "view",
  integrationId: string | undefined,
  icon: string | undefined,
  isPinned: (resourceUri: string) => boolean,
  togglePin: (tab: PinnedTabInput) => void,
): CustomRowAction {
  const resourceUri = buildResourceUriForType(
    resourceType,
    resourceId,
    integrationId,
  );
  const pinned = isPinned(resourceUri);

  // Generic label formatting - capitalize first letter
  const resourceTypeLabel = resourceType
    ? resourceType.charAt(0).toUpperCase() + resourceType.slice(1)
    : "Resource";

  return {
    label: pinned ? "Unpin from sidebar" : "Pin to sidebar",
    icon: pinned ? "keep_off" : "keep",
    onClick: () => {
      togglePin({
        resourceUri,
        title: resourceName,
        type: "detail",
        icon: icon?.toLowerCase(),
      });
      toast.success(
        `${resourceTypeLabel} "${resourceName}" ${pinned ? "unpinned" : "pinned"} from sidebar`,
      );
    },
  };
}
