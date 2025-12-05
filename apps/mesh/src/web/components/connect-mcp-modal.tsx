import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@deco/ui/components/dialog.js";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.js";
import { ConnectionEntitySchema } from "@/tools/connection/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.js";
import { Button } from "@deco/ui/components/button.js";
import { Textarea } from "@deco/ui/components/textarea.js";
import type { authClient } from "../lib/auth-client";
import type { ConnectionEntity } from "@/tools/connection/schema";
import { CONNECTIONS_COLLECTION } from "../hooks/collections/use-connection";

export type EditingConnection = ConnectionEntity | null;

interface ConnectMCPModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingConnection: EditingConnection;
  org: string;
  collection: typeof CONNECTIONS_COLLECTION;
  session: ReturnType<typeof authClient.useSession>["data"];
  onSubmit: (data: ConnectionFormData) => void;
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

export function ConnectMCPModal({
  open,
  onOpenChange,
  editingConnection,
  onSubmit,
}: ConnectMCPModalProps) {
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

  // oxlint-disable-next-line ban-use-effect/ban-use-effect
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                    <Select value={field.value} onValueChange={field.onChange}>
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
                      <Input placeholder="https://example.com/mcp" {...field} />
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
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingConnection ? "Update Connection" : "Create Connection"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
