import { Dialog, DialogDescription, DialogHeader, DialogContent, DialogTitle, DialogFooter } from "@deco/ui/components/dialog.js";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
  } from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.js";
import { useNavigate } from "@tanstack/react-router";
import { ConnectionEntitySchema } from "@/tools/connection/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Dispatch, useEffect } from "react";
import { DialogAction, EditingConnection } from "../routes/orgs/connections";
import { z } from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@deco/ui/components/select.js";
import { Button } from "@deco/ui/components/button.js";
import { Textarea } from "@deco/ui/components/textarea.js";
import { toast } from "sonner";
import type { useConnectionsCollection } from "../hooks/collections/use-connection";
import type { authClient } from "../lib/auth-client";

interface ConnectMCPModalProps {
    open: boolean;
    editingConnection: EditingConnection;
    isCreating: boolean;
    dispatch: Dispatch<DialogAction>;
    org: string;
    collection: ReturnType<typeof useConnectionsCollection>;
    session: ReturnType<typeof authClient.useSession>["data"];
}

const connectionFormSchema = ConnectionEntitySchema.pick({
    title: true,
    description: true,
    connection_type: true,
    connection_url: true,
    connection_token: true,
  }).partial({
    // These are optional for form input
    description: true,
    connection_token: true,
  });
  
  export type ConnectionFormData = z.infer<typeof connectionFormSchema>;

export function ConnectMCPModal({ open, isCreating, editingConnection, dispatch, org, collection, session }: ConnectMCPModalProps) {
    const navigate = useNavigate();

    const form = useForm<ConnectionFormData>({
        resolver: zodResolver(connectionFormSchema),
        defaultValues: {
          title: "",
          description: null,
          connection_type: "HTTP",
          connection_url: "",
          connection_token: null,
        },
      });

      useEffect(() => {
        if (editingConnection) {
          form.reset({
            title: editingConnection.title,
            description: editingConnection.description,
            connection_type: editingConnection.connection_type,
            connection_url: editingConnection.connection_url,
            connection_token: null, // Don't pre-fill token for security
          });
        } else {
          form.reset({
            title: "",
            description: null,
            connection_type: "HTTP",
            connection_url: "",
            connection_token: null,
          });
        }
      }, [editingConnection, form]);

    const closeCreateDialog = (org: string) => {
        navigate({ to: "/$org/mcps", params: { org }, search: {} });
      };
    
    const onSubmit = async (data: ConnectionFormData) => {
        try {
          // Close dialog based on mode
          if (isCreating) {
            closeCreateDialog(org);
          } else {
            dispatch({ type: "close" });
          }
          form.reset();
    
          if (editingConnection) {
            // Update existing connection
            const tx = collection.update(editingConnection.id, (draft) => {
              draft.title = data.title;
              draft.description = data.description || null;
              draft.connection_type = data.connection_type;
              draft.connection_url = data.connection_url;
              if (data.connection_token) {
                draft.connection_token = data.connection_token;
              }
            });
            await tx.isPersisted.promise;
          } else {
            // Create new connection - cast through unknown because the insert API
            // accepts ConnectionCreateInput but the collection is typed as ConnectionEntity
            const tx = collection.insert({
              id: crypto.randomUUID(),
              title: data.title,
              description: data.description || null,
              connection_type: data.connection_type,
              connection_url: data.connection_url,
              connection_token: data.connection_token || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: "inactive",
              organization_id: org,
              created_by: session?.user?.id ?? "unknown",
              icon: null,
              app_name: null,
              app_id: null,
              connection_headers: null,
              oauth_config: null,
              configuration_state: null,
              metadata: null,
              tools: null,
              bindings: null,
            });
            await tx.isPersisted.promise;
          }
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Failed to save connection",
          );
        }
      };
    
      const handleDialogClose = (open: boolean) => {
        if (!open) {
          if (isCreating) {
            closeCreateDialog(org);
            console.log("closeCreateDialog", org);
          } else {
            dispatch({ type: "close" });
            console.log("dispatch close");
          }
          form.reset();
        }
      };

    return (
        <Dialog
        open={open}
        onOpenChange={handleDialogClose}
      >
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>
              {editingConnection ? "Edit Connection" : "Create New Connection"}
            </DialogTitle>
            <DialogDescription>
              {editingConnection
                ? "Update the connection details below."
                : "Add a new connection to your organization. Fill in the details below."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 py-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="My Connection" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="A brief description of this connection"
                          rows={3}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="connection_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="HTTP">HTTP</SelectItem>
                          <SelectItem value="SSE">SSE</SelectItem>
                          <SelectItem value="Websocket">Websocket</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="connection_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/mcp"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="connection_token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Bearer token or API key"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogClose(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingConnection
                    ? "Update Connection"
                    : "Create Connection"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
}