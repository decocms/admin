import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
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
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { MultiSelect } from "@deco/ui/components/multi-select.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { authClient } from "@/web/lib/auth-client";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { KEYS } from "@/web/lib/query-keys";
import { useConnections } from "@/web/hooks/collections/use-connection";
import { getPermissionOptions, type ToolName } from "@/tools/registry";

interface CreateRoleDialogProps {
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

type CreateRoleFormData = {
  roleName: string;
  // Static permissions (organization-level)
  allowAllStaticPermissions: boolean;
  staticPermissions: ToolName[];
  // Connection-specific permissions
  allowAllConnections: boolean;
  connectionIds: string[];
  allowAllTools: boolean;
  toolNames: string[];
};

export function CreateRoleDialog({
  trigger,
  onSuccess,
}: CreateRoleDialogProps) {
  const [open, setOpen] = useState(false);
  const { locator } = useProjectContext();
  const queryClient = useQueryClient();

  // Get all connections for selection
  const connections = useConnections() ?? [];

  const form = useForm<CreateRoleFormData>({
    mode: "onChange",
    defaultValues: {
      roleName: "",
      allowAllStaticPermissions: true,
      staticPermissions: [],
      allowAllConnections: false,
      connectionIds: [],
      allowAllTools: true,
      toolNames: [],
    },
  });

  const allowAllStaticPermissions = form.watch("allowAllStaticPermissions");
  const staticPermissions = form.watch("staticPermissions");
  const allowAllConnections = form.watch("allowAllConnections");
  const allowAllTools = form.watch("allowAllTools");
  const roleName = form.watch("roleName");
  const connectionIds = form.watch("connectionIds");
  const toolNames = form.watch("toolNames");

  // Build static permission options for MultiSelect (type-safe from registry)
  const staticPermissionOptions = useMemo(() => {
    return getPermissionOptions().map((p) => ({
      value: p.value,
      label: p.label,
    }));
  }, []);

  // Get available tools from selected connections
  const availableTools = useMemo(() => {
    if (allowAllConnections) {
      // Show all tools from all connections
      const allTools = new Map<string, { name: string; connection: string }>();
      for (const conn of connections) {
        if (conn.tools) {
          for (const tool of conn.tools) {
            if (!allTools.has(tool.name)) {
              allTools.set(tool.name, {
                name: tool.name,
                connection: conn.title || conn.id,
              });
            }
          }
        }
      }
      return Array.from(allTools.values());
    } else {
      // Show tools only from selected connections
      const selectedConns = connections.filter((c) =>
        connectionIds.includes(c.id),
      );
      const tools = new Map<string, { name: string; connection: string }>();
      for (const conn of selectedConns) {
        if (conn.tools) {
          for (const tool of conn.tools) {
            if (!tools.has(tool.name)) {
              tools.set(tool.name, {
                name: tool.name,
                connection: conn.title || conn.id,
              });
            }
          }
        }
      }
      return Array.from(tools.values());
    }
  }, [connections, connectionIds, allowAllConnections]);

  const createRoleMutation = useMutation({
    mutationFn: async (data: CreateRoleFormData) => {
      // Build permission object
      // Format: { "self": ["PERM1", "PERM2"], "<connectionId>": ["tool1", "tool2"] }
      const permission: Record<string, string[]> = {};

      // Add static/organization-level permissions under "self"
      if (data.allowAllStaticPermissions) {
        permission["self"] = ["*"];
      } else if (data.staticPermissions.length > 0) {
        permission["self"] = data.staticPermissions;
      }

      // Determine which tools to allow for connections
      const toolsToAllow = data.allowAllTools ? ["*"] : data.toolNames;

      if (data.allowAllConnections) {
        // Allow access to all connections
        permission["*"] = toolsToAllow;
      } else if (data.connectionIds.length > 0) {
        // Allow access to specific connections
        for (const connId of data.connectionIds) {
          permission[connId] = toolsToAllow;
        }
      }

      // Create the role using Better Auth's dynamic access control
      // API expects: { role: string, permission: Record<string, string[]> }
      const result = await authClient.organization.createRole({
        role: data.roleName.toLowerCase().replace(/\s+/g, "-"),
        permission,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.members(locator) });
      // Invalidate organization roles query
      queryClient.invalidateQueries({
        queryKey: KEYS.organizationRoles(locator),
      });
      toast.success("Role created successfully!");
      form.reset({
        roleName: "",
        allowAllStaticPermissions: true,
        staticPermissions: [],
        allowAllConnections: false,
        connectionIds: [],
        allowAllTools: true,
        toolNames: [],
      });
      setOpen(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to create role",
      );
    },
  });

  const handleSubmit = (data: CreateRoleFormData) => {
    if (!data.roleName.trim()) {
      toast.error("Please enter a role name");
      return;
    }

    // Validate static permissions
    if (
      !data.allowAllStaticPermissions &&
      data.staticPermissions.length === 0
    ) {
      toast.error(
        "Please select at least one organization permission or allow all",
      );
      return;
    }

    // Connection permissions are optional - a role can have only org-level permissions
    if (data.connectionIds.length > 0 || data.allowAllConnections) {
      if (!data.allowAllTools && data.toolNames.length === 0) {
        toast.error("Please select at least one tool or allow all tools");
        return;
      }
    }

    createRoleMutation.mutate(data);
  };

  // Build connection options for MultiSelect
  const connectionOptions = connections.map((conn) => ({
    value: conn.id,
    label: conn.title || conn.id,
  }));

  // Build tool options for MultiSelect
  const toolOptions = availableTools.map((tool) => ({
    value: tool.name,
    label: tool.name,
  }));

  // Form is valid if we have a name and at least static permissions configured
  const hasStaticPerms =
    allowAllStaticPermissions || staticPermissions.length > 0;
  const hasConnectionPerms = allowAllConnections || connectionIds.length > 0;
  const hasToolPerms = allowAllTools || toolNames.length > 0;

  // Valid if: name + static perms, and if connections selected then tools must be configured
  const isFormValid =
    roleName.trim().length > 0 &&
    hasStaticPerms &&
    (!hasConnectionPerms || hasToolPerms);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Role</DialogTitle>
          <DialogDescription>
            Create a new role with specific connection and tool permissions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="roleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Developer, Viewer, Support"
                      disabled={createRoleMutation.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    A unique name for this role. Will be converted to lowercase
                    with hyphens.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Organization Permissions Section */}
            <div className="space-y-3">
              <div className="text-sm font-medium">
                Organization Permissions
              </div>

              <FormField
                control={form.control}
                name="allowAllStaticPermissions"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={createRoleMutation.isPending}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Allow all organization permissions</FormLabel>
                      <FormDescription>
                        Full access to organization, members, and connection
                        management.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {!allowAllStaticPermissions && (
                <FormField
                  control={form.control}
                  name="staticPermissions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Permissions{" "}
                        <Badge variant="secondary" className="ml-2">
                          {staticPermissionOptions.length} available
                        </Badge>
                      </FormLabel>
                      <FormControl>
                        <MultiSelect
                          options={staticPermissionOptions}
                          defaultValue={field.value}
                          onValueChange={field.onChange}
                          placeholder="Select permissions"
                          variant="secondary"
                          className="w-full max-w-none"
                          disabled={createRoleMutation.isPending}
                          maxCount={3}
                        />
                      </FormControl>
                      <FormDescription>
                        Select specific organization-level permissions for this
                        role.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Connection Permissions Section */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Connection Permissions</div>

              <FormField
                control={form.control}
                name="allowAllConnections"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={createRoleMutation.isPending}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Allow all connections</FormLabel>
                      <FormDescription>
                        Members with this role can access all connections,
                        including future ones.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {!allowAllConnections && (
                <FormField
                  control={form.control}
                  name="connectionIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Connections</FormLabel>
                      <FormControl>
                        <MultiSelect
                          options={connectionOptions}
                          defaultValue={field.value}
                          onValueChange={field.onChange}
                          placeholder="Select connections"
                          variant="secondary"
                          className="w-full max-w-none"
                          disabled={createRoleMutation.isPending}
                          maxCount={3}
                        />
                      </FormControl>
                      <FormDescription>
                        Select which connections members with this role can
                        access.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Tool Permissions Section */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Tool Permissions</div>

              <FormField
                control={form.control}
                name="allowAllTools"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={createRoleMutation.isPending}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Allow all tools</FormLabel>
                      <FormDescription>
                        Members with this role can use all tools from the
                        selected connections.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {!allowAllTools && (
                <FormField
                  control={form.control}
                  name="toolNames"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Tools{" "}
                        {availableTools.length > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {availableTools.length} available
                          </Badge>
                        )}
                      </FormLabel>
                      <FormControl>
                        <MultiSelect
                          options={toolOptions}
                          defaultValue={field.value}
                          onValueChange={field.onChange}
                          placeholder={
                            availableTools.length === 0
                              ? "Select connections first"
                              : "Select tools"
                          }
                          variant="secondary"
                          className="w-full max-w-none"
                          disabled={
                            createRoleMutation.isPending ||
                            availableTools.length === 0
                          }
                          maxCount={3}
                        />
                      </FormControl>
                      <FormDescription>
                        Select specific tools that members with this role can
                        use.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  form.reset();
                  setOpen(false);
                }}
                type="button"
                disabled={createRoleMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createRoleMutation.isPending || !isFormValid}
              >
                {createRoleMutation.isPending ? "Creating..." : "Create Role"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
