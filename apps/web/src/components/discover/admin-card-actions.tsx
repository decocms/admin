import { type Integration, MCPClient, useSDK } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppEditModal } from "./app-edit-modal.tsx";

interface AdminCardActionsProps {
  app: Integration;
  onUpdate?: () => void;
  editOnly?: boolean;
  actionsOnly?: boolean;
  visibilityOnly?: boolean;
}

export function AdminCardActions({
  app,
  onUpdate,
  editOnly = false,
  actionsOnly = false,
  visibilityOnly = false,
}: AdminCardActionsProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [isTogglingVerified, setIsTogglingVerified] = useState(false);
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  const toggleVisibility = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!locator || !app.id) return;

    setIsTogglingVisibility(true);
    try {
      const client = MCPClient.forLocator(locator);
      await client.MARKETPLACE_APP_UPDATE_ADMIN({
        appId: app.id,
        unlisted: !(app as { unlisted?: boolean }).unlisted,
      });

      // Invalidate queries to refetch the data
      queryClient.invalidateQueries({
        queryKey: ["integrations", "marketplace"],
      });
      queryClient.invalidateQueries({ queryKey: ["unlisted-apps"] });

      toast.success(
        (app as { unlisted?: boolean }).unlisted
          ? "App is now visible"
          : "App is now hidden",
      );

      onUpdate?.();
    } catch (error) {
      toast.error("Failed to toggle visibility");
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const toggleVerified = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!locator || !app.id) return;

    setIsTogglingVerified(true);
    try {
      const client = MCPClient.forLocator(locator);
      await client.MARKETPLACE_APP_UPDATE_ADMIN({
        appId: app.id,
        verified: !app.verified,
      });

      // Invalidate queries to refetch the data
      queryClient.invalidateQueries({
        queryKey: ["integrations", "marketplace"],
      });
      queryClient.invalidateQueries({ queryKey: ["unlisted-apps"] });

      toast.success(app.verified ? "App verification removed" : "App verified");

      onUpdate?.();
    } catch (error) {
      toast.error("Failed to toggle verification");
    } finally {
      setIsTogglingVerified(false);
    }
  };

  // Render only edit button (pencil icon in top-right)
  if (editOnly) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setEditModalOpen(true);
          }}
          className="h-8 w-8 p-0"
          title="Edit app"
        >
          <Icon name="edit" size={16} />
        </Button>
        <AppEditModal
          app={app}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onSave={() => {
            onUpdate?.();
          }}
        />
      </div>
    );
  }

  // Render only visibility button (for unlisted apps section)
  if (visibilityOnly) {
    return (
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant={
            (app as { unlisted?: boolean }).unlisted ? "outline" : "default"
          }
          title={
            (app as { unlisted?: boolean }).unlisted
              ? "Make Visible"
              : "Make Unlisted"
          }
          onClick={toggleVisibility}
          disabled={isTogglingVisibility}
          className="h-8 flex-1"
        >
          <Icon
            name={
              (app as { unlisted?: boolean }).unlisted
                ? "visibility_off"
                : "visibility"
            }
            size={16}
            className="mr-1"
          />
          {(app as { unlisted?: boolean }).unlisted ? "Visible" : "Hidden"}
        </Button>
      </div>
    );
  }

  // Render action buttons (visibility and verification at bottom)
  if (actionsOnly) {
    return (
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant={
            (app as { unlisted?: boolean }).unlisted ? "outline" : "default"
          }
          title={
            (app as { unlisted?: boolean }).unlisted
              ? "Make Visible"
              : "Make Unlisted"
          }
          onClick={toggleVisibility}
          disabled={isTogglingVisibility}
          className="h-8 flex-1"
        >
          <Icon
            name={
              (app as { unlisted?: boolean }).unlisted
                ? "visibility_off"
                : "visibility"
            }
            size={16}
            className="mr-1"
          />
          {(app as { unlisted?: boolean }).unlisted ? "Visible" : "Hidden"}
        </Button>

        <Button
          size="sm"
          variant={app.verified ? "default" : "outline"}
          title={app.verified ? "Unverify App" : "Verify App"}
          onClick={toggleVerified}
          disabled={isTogglingVerified}
          className="h-8 flex-1"
        >
          <Icon
            name={app.verified ? "verified" : "close"}
            size={16}
            className="mr-1"
          />
          {app.verified ? "Verified" : "Verify"}
        </Button>
      </div>
    );
  }

  return null;
}
