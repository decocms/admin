import { ConnectionEntitySchema } from "@/tools/connection/schema";
import type { ConnectionEntity } from "@/tools/connection/schema";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, CheckCircle2, Globe, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v3";

const connectionFormSchema = ConnectionEntitySchema.pick({
  title: true,
  description: true,
  connection_type: true,
  connection_url: true,
  connection_token: true,
}).partial({
  description: true,
  connection_token: true,
});

type ConnectionFormData = z.infer<typeof connectionFormSchema>;

interface ConnectionDetailsSidebarProps {
  connection: ConnectionEntity;
  onUpdate?: (connection: Partial<ConnectionEntity>) => Promise<void>;
}

export function ConnectionDetailsSidebar({
  connection,
  onUpdate,
}: ConnectionDetailsSidebarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const { org } = useParams({ strict: false });

  const form = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionFormSchema),
    defaultValues: {
      title: connection.title,
      description: connection.description,
      connection_type: connection.connection_type,
      connection_url: connection.connection_url,
      connection_token: connection.connection_token,
    },
  });

  // Reset form when connection changes (external update)
  useEffect(() => {
    form.reset({
      title: connection.title,
      description: connection.description,
      connection_type: connection.connection_type,
      connection_url: connection.connection_url,
      connection_token: connection.connection_token,
    });
  }, [connection, form]);

  const onSubmit = async (data: ConnectionFormData) => {
    if (!onUpdate) return;
    setIsSaving(true);
    try {
      await onUpdate({
        ...data,
        description: data.description || null,
        connection_token: data.connection_token || null,
      });
      form.reset(data); // Reset dirty state with new values
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full border-r border-border w-[320px] bg-background shrink-0">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate({ to: `/${org}/mcps` })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="p-6 border-b border-border flex flex-col gap-4">
            <div className="h-16 w-16 rounded-2xl border border-border/50 bg-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="w-full space-y-0">
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          {...field}
                          className="h-auto text-xl font-semibold px-0 border-transparent hover:border-input focus:border-input bg-transparent transition-all p-0"
                          placeholder="Connection Name"
                        />
                      </FormControl>
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="w-full space-y-0">
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        className="h-auto text-sm text-muted-foreground px-0 border-transparent hover:border-input focus:border-input bg-transparent transition-all"
                        placeholder="Add a description..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="p-6 flex flex-col gap-4 border-b border-border flex-1 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <FormLabel>Connection</FormLabel>
              <div className="flex rounded-md shadow-sm">
                <FormField
                  control={form.control}
                  name="connection_type"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-[100px] rounded-r-none border-r-0 bg-muted/50 focus:ring-0 focus:ring-offset-0">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="HTTP">HTTP</SelectItem>
                          <SelectItem value="SSE">SSE</SelectItem>
                          <SelectItem value="Websocket">Websocket</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="connection_url"
                  render={({ field }) => (
                    <FormItem className="flex-1 space-y-0">
                      <FormControl>
                        <Input
                          placeholder="https://example.com/mcp"
                          {...field}
                          className="rounded-l-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="connection_type"
                render={() => <FormMessage />}
              />
              <FormField
                control={form.control}
                name="connection_url"
                render={() => <FormMessage />}
              />
            </div>

            <FormField
              control={form.control}
              name="connection_token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Token</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={
                        connection.connection_token
                          ? "••••••••"
                          : "No token set"
                      }
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="p-6 mt-auto bg-muted/5 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="font-mono uppercase text-muted-foreground">
                {connection.updated_at
                  ? formatDistanceToNow(new Date(connection.updated_at), {
                      addSuffix: true,
                    })
                  : "Unknown"}
              </span>
            </div>

            {form.formState.isDirty && (
              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
