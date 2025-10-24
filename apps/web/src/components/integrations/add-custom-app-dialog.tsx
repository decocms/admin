import { useCreateIntegration, type MCPConnection } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { PasswordInput } from "@deco/ui/components/password-input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { trackEvent } from "../../hooks/analytics.ts";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { AppKeys, getConnectionAppKey } from "./apps.ts";
import { IntegrationIcon } from "./common.tsx";
import { useWriteFile } from "@deco/sdk";

interface CustomAppFormData {
  name: string;
  description?: string;
  icon: string;
  connection: MCPConnection;
}

const ICON_FILE_PATH = "assets/integrations";

function useIconFilename() {
  function generate(originalFile: File) {
    const extension =
      originalFile.name.split(".").pop()?.toLowerCase() || "png";
    return `icon-${crypto.randomUUID()}.${extension}`;
  }
  return { generate };
}

function useIconUpload(form: ReturnType<typeof useForm<CustomAppFormData>>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const writeFileMutation = useWriteFile();
  const { generate: generateIconFilename } = useIconFilename();
  const [isUploading, setIsUploading] = useState(false);
  const iconValue = form.watch("icon");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    try {
      setIsUploading(true);
      const filename = generateIconFilename(file);
      const path = `${ICON_FILE_PATH}/${filename}`;
      const buffer = await file.arrayBuffer();
      await writeFileMutation.mutateAsync({
        path,
        contentType: file.type,
        content: new Uint8Array(buffer),
      });
      form.setValue("icon", path, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    } catch (error) {
      console.error("Failed to upload icon:", error);
      toast.error("Failed to upload icon");
    } finally {
      setIsUploading(false);
    }
  };

  function triggerFileInput() {
    fileInputRef.current?.click();
  }

  return {
    fileInputRef,
    isUploading,
    iconValue,
    handleFileChange,
    triggerFileInput,
  };
}

interface AddCustomAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCustomAppDialog({
  open,
  onOpenChange,
}: AddCustomAppDialogProps) {
  const form = useForm<CustomAppFormData>({
    defaultValues: {
      name: "",
      description: "",
      icon: "icon://linked_services",
      connection: {
        type: "HTTP",
        url: "https://example.com/mcp",
        token: "",
      },
    },
  });

  const createIntegration = useCreateIntegration();
  const navigateWorkspace = useNavigateWorkspace();
  const connection = form.watch("connection");

  const {
    fileInputRef,
    isUploading,
    iconValue,
    handleFileChange,
    triggerFileInput,
  } = useIconUpload(form);

  const handleConnectionTypeChange = (value: MCPConnection["type"]) => {
    const currentConnection = form.getValues("connection");
    form.setValue(
      "connection",
      value === "SSE" || value === "HTTP"
        ? {
            type: value,
            url:
              currentConnection?.type === "SSE" ||
              currentConnection?.type === "HTTP"
                ? currentConnection.url || "https://example.com/mcp"
                : "https://example.com/mcp",
            token:
              currentConnection?.type === "SSE" ||
              currentConnection?.type === "HTTP"
                ? currentConnection.token
                : "",
          }
        : value === "Websocket"
          ? {
              type: "Websocket",
              url:
                currentConnection?.type === "Websocket"
                  ? currentConnection.url || "wss://example.com/ws"
                  : "wss://example.com/ws",
            }
          : {
              type: "Deco",
              tenant:
                currentConnection?.type === "Deco"
                  ? currentConnection.tenant || "tenant-id"
                  : "tenant-id",
              token:
                currentConnection?.type === "Deco"
                  ? currentConnection.token
                  : "",
            },
    );
  };

  const onSubmit = async (data: CustomAppFormData) => {
    try {
      const result = await createIntegration.mutateAsync({
        name: data.name || "Custom integration",
        description: data.description || "A custom integration to a MCP server",
        icon: data.icon,
        connection: data.connection,
      });

      trackEvent("integration_create_custom", {
        success: true,
        connection_type: data.connection.type,
      });

      toast.success("Custom app added successfully");
      onOpenChange(false);
      form.reset();

      // Navigate to the newly created app
      const key = getConnectionAppKey(result);
      navigateWorkspace(`/apps/${AppKeys.build(key)}`);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to create custom app",
      );

      trackEvent("integration_create_custom", {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Custom App</DialogTitle>
          <DialogDescription>
            Connect to a custom app by providing its details
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-start gap-4">
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Input type="hidden" {...field} />
                    <FormControl>
                      {iconValue ? (
                        <div
                          onClick={triggerFileInput}
                          className="w-[168px] h-[168px] relative group cursor-pointer"
                        >
                          <IntegrationIcon
                            icon={iconValue}
                            className={cn(
                              "w-[168px] h-[168px] bg-background",
                              isUploading && "opacity-50",
                            )}
                          />
                          <div className="rounded-xl transition-all absolute top-0 left-0 w-full h-full opacity-0 group-hover:opacity-90 flex items-center justify-center bg-accent">
                            <Icon name="upload" size={32} />
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={triggerFileInput}
                          className="w-[168px] h-[168px] flex flex-col items-center justify-center gap-2 border border-border bg-background rounded-xl cursor-pointer"
                        >
                          <Icon name="upload" size={32} />
                          <span className="text-xs text-muted-foreground/70 text-center px-1">
                            Icon
                          </span>
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex-1 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Custom App" {...field} />
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
                      <FormLabel>
                        Description{" "}
                        <span className="text-[10px] text-muted-foreground">
                          optional
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="A custom MCP server" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {["SSE", "HTTP"].includes(connection.type) && (
              <>
                <div className="grid grid-cols-[auto_1fr] gap-2 items-end">
                  <FormField
                    control={form.control}
                    name="connection.type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select
                          onValueChange={(value: MCPConnection["type"]) => {
                            field.onChange(value);
                            handleConnectionTypeChange(value);
                          }}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="HTTP">HTTP</SelectItem>
                            <SelectItem value="SSE">SSE</SelectItem>
                            <SelectItem value="Websocket">WebSocket</SelectItem>
                            <SelectItem value="Deco">Deco</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="connection.url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL</FormLabel>
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
                </div>
                <FormField
                  control={form.control}
                  name="connection.token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Token{" "}
                        <span className="text-[10px] text-muted-foreground">
                          optional
                        </span>
                      </FormLabel>
                      <FormControl>
                        <PasswordInput placeholder="token" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {connection.type === "Websocket" && (
              <div className="grid grid-cols-[auto_1fr] gap-2 items-end">
                <FormField
                  control={form.control}
                  name="connection.type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select
                        onValueChange={(value: MCPConnection["type"]) => {
                          field.onChange(value);
                          handleConnectionTypeChange(value);
                        }}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="HTTP">HTTP</SelectItem>
                          <SelectItem value="SSE">SSE</SelectItem>
                          <SelectItem value="Websocket">WebSocket</SelectItem>
                          <SelectItem value="Deco">Deco</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="connection.url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL</FormLabel>
                      <FormControl>
                        <Input placeholder="wss://example.com/ws" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {connection.type === "Deco" && (
              <>
                <div className="grid grid-cols-[auto_1fr] gap-2 items-end">
                  <FormField
                    control={form.control}
                    name="connection.type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select
                          onValueChange={(value: MCPConnection["type"]) => {
                            field.onChange(value);
                            handleConnectionTypeChange(value);
                          }}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="HTTP">HTTP</SelectItem>
                            <SelectItem value="SSE">SSE</SelectItem>
                            <SelectItem value="Websocket">WebSocket</SelectItem>
                            <SelectItem value="Deco">Deco</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="connection.tenant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenant ID</FormLabel>
                        <FormControl>
                          <Input placeholder="tenant-id" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="connection.token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Token{" "}
                        <span className="text-[10px] text-muted-foreground">
                          optional
                        </span>
                      </FormLabel>
                      <FormControl>
                        <PasswordInput placeholder="token" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                }}
                disabled={createIntegration.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createIntegration.isPending}>
                {createIntegration.isPending ? (
                  <>
                    <Spinner /> Adding...
                  </>
                ) : (
                  "Add"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
