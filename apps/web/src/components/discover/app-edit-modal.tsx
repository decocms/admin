import { type Integration, KEYS, MCPClient, useSDK } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";

interface AppEditModalProps {
  app: Integration;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function AppEditModal({
  app,
  open,
  onOpenChange,
  onSave,
}: AppEditModalProps) {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      friendlyName: (app as { friendlyName?: string }).friendlyName ?? "",
      description: app.description ?? "",
      icon: app.icon ?? "",
    },
  });

  const onSubmit = async (data: {
    friendlyName: string;
    description: string;
    icon: string;
  }) => {
    if (!locator || !app.id) return;

    try {
      const client = MCPClient.forLocator(locator);
      await client.MARKETPLACE_APP_UPDATE_ADMIN({
        appId: app.id,
        friendlyName: data.friendlyName || undefined,
        description: data.description || undefined,
        icon: data.icon || undefined,
      });

      // Invalidate queries to refetch the data
      queryClient.invalidateQueries({
        queryKey: KEYS.INTEGRATIONS_MARKETPLACE(),
      });
      queryClient.invalidateQueries({ queryKey: KEYS.UNLISTED_APPS() });

      toast.success("App updated successfully");
      onSave();
      onOpenChange(false);
    } catch {
      toast.error("Failed to update app");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit App</DialogTitle>
          <DialogDescription>
            Update the app's display name, description, and icon.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-4"
          >
            {/* Icon Preview and Input */}
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center gap-2">
                <IntegrationAvatar
                  url={form.watch("icon")}
                  fallback={form.watch("friendlyName") || app.name}
                  size="lg"
                />
                <span className="text-xs text-muted-foreground">Preview</span>
              </div>

              <FormField
                name="icon"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Icon URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/icon.png"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>URL of the app icon image</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Friendly Name */}
            <FormField
              name="friendlyName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Friendly Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Awesome App" {...field} />
                  </FormControl>
                  <FormDescription>Display name shown to users</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              name="description"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="A brief description of what this app does..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Short description of the app's purpose
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
