import { getPermissionOptions, type ToolName } from "@/tools/registry";
import { useConnections } from "@/web/hooks/collections/use-connection";
import {
  useOrganizationRoles,
  type OrganizationRole,
} from "@/web/hooks/use-organization-roles";
import { authClient } from "@/web/lib/auth-client";
import { KEYS } from "@/web/lib/query-keys";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { MultiSelect } from "@deco/ui/components/multi-select.tsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface CreateRoleDialogProps {
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

type RoleFormData = {
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
  const [editingRole, setEditingRole] = useState<OrganizationRole | null>(null);
  const [showRoleSuggestions, setShowRoleSuggestions] = useState(false);
  const roleInputRef = useRef<HTMLInputElement>(null);
  const { locator } = useProjectContext();
  const queryClient = useQueryClient();

  // Get all connections for selection
  const connections = useConnections() ?? [];

  // Get existing custom roles for suggestions
  const { customRoles, refetch: refetchRoles } = useOrganizationRoles();

  const form = useForm<RoleFormData>({
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

  // Filter roles based on input
  const filteredRoles = (() => {
    if (!roleName.trim()) {
      // Show all custom roles when input is empty
      return customRoles;
    }
    const searchTerm = roleName.toLowerCase().replace(/\s+/g, "-");
    return customRoles.filter(
      (role) =>
        role.role.toLowerCase().includes(searchTerm) ||
        role.label.toLowerCase().includes(roleName.toLowerCase()),
    );
  })();

  // Load role data into form when editing
  const loadRoleForEditing = (role: OrganizationRole) => {
    setEditingRole(role);
    setShowRoleSuggestions(false);

    // Parse the permission object to populate form
    const permission = role.permission || {};

    // Check for static permissions under "self"
    const selfPerms = permission["self"] || [];
    const hasAllStaticPerms = selfPerms.includes("*");
    const staticPerms = hasAllStaticPerms
      ? []
      : (selfPerms.filter((p) => p !== "*") as ToolName[]);

    // Check for connection permissions
    const connectionKeys = Object.keys(permission).filter((k) => k !== "self");
    const hasAllConnections = connectionKeys.includes("*");
    const specificConnections = connectionKeys.filter((k) => k !== "*");

    // Check for tool permissions (from first connection or wildcard)
    const firstConnectionKey = connectionKeys[0];
    const sampleTools =
      permission["*"] ||
      (firstConnectionKey ? permission[firstConnectionKey] : []) ||
      [];
    const hasAllTools = sampleTools.includes("*");
    const specificTools = hasAllTools
      ? []
      : sampleTools.filter((t: string) => t !== "*");

    form.reset({
      roleName: role.label,
      allowAllStaticPermissions: hasAllStaticPerms,
      staticPermissions: staticPerms,
      allowAllConnections: hasAllConnections,
      connectionIds: specificConnections,
      allowAllTools: hasAllTools,
      toolNames: specificTools,
    });
  };

  // Handle dialog open/close
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Reset state when dialog closes
      setEditingRole(null);
      setShowRoleSuggestions(false);
    }
  };

  // Build static permission options for MultiSelect (type-safe from registry)
  const staticPermissionOptions = getPermissionOptions().map((p) => ({
    value: p.value,
    label: p.label,
  }));

  // Get available tools from selected connections
  const availableTools = (() => {
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
  })();

  // Build permission object from form data
  const buildPermission = (data: RoleFormData): Record<string, string[]> => {
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

    return permission;
  };

  const createRoleMutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      const permission = buildPermission(data);

      // Create the role using Better Auth's dynamic access control
      // API expects: { role: string, permission: Record<string, string[]> }
      // @ts-expect-error - createRole may not be in the type definition
      const createRole = authClient.organization?.createRole;
      if (typeof createRole !== "function") {
        throw new Error("Create role API not available");
      }

      const result = await createRole({
        role: data.roleName.toLowerCase().replace(/\s+/g, "-"),
        permission,
      });

      if (result?.error) {
        throw new Error(result.error.message);
      }

      return result?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.members(locator) });
      queryClient.invalidateQueries({
        queryKey: KEYS.organizationRoles(locator),
      });
      toast.success("Role created successfully!");
      resetForm();
      setOpen(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to create role",
      );
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (formData: RoleFormData & { roleId: string }) => {
      const permission = buildPermission(formData);

      // Update the role using Better Auth's dynamic access control
      // API expects: { roleId: string, data: { permission: Record<string, string[]> } }
      // @ts-expect-error - updateRole may not be in the type definition
      const updateRole = authClient.organization?.updateRole;
      if (typeof updateRole !== "function") {
        throw new Error("Update role API not available");
      }

      const result = await updateRole({
        roleId: formData.roleId,
        data: {
          permission,
        },
      });

      if (result?.error) {
        throw new Error(result.error.message);
      }

      return result?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.members(locator) });
      queryClient.invalidateQueries({
        queryKey: KEYS.organizationRoles(locator),
      });
      toast.success("Role updated successfully!");
      resetForm();
      setOpen(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update role",
      );
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      // @ts-expect-error - deleteRole may not be in the type definition
      const deleteRole = authClient.organization?.deleteRole;
      if (typeof deleteRole !== "function") {
        throw new Error("Delete role API not available");
      }

      const result = await deleteRole({ roleId });

      if (result?.error) {
        throw new Error(result.error.message);
      }

      return result?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.members(locator) });
      queryClient.invalidateQueries({
        queryKey: KEYS.organizationRoles(locator),
      });
      toast.success("Role deleted successfully!");
      resetForm();
      refetchRoles();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete role",
      );
    },
  });

  const resetForm = () => {
    setEditingRole(null);
    setShowRoleSuggestions(false);
    form.reset({
      roleName: "",
      allowAllStaticPermissions: true,
      staticPermissions: [],
      allowAllConnections: false,
      connectionIds: [],
      allowAllTools: true,
      toolNames: [],
    });
  };

  const isPending =
    createRoleMutation.isPending ||
    updateRoleMutation.isPending ||
    deleteRoleMutation.isPending;

  const handleSubmit = (data: RoleFormData) => {
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

    if (editingRole?.id) {
      updateRoleMutation.mutate({ ...data, roleId: editingRole.id });
    } else {
      createRoleMutation.mutate(data);
    }
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingRole ? "Edit Role" : "Create Role"}</DialogTitle>
          <DialogDescription>
            {editingRole
              ? `Update permissions for the "${editingRole.label}" role.`
              : "Create a new role or select an existing one to edit."}
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
                <FormItem className="relative">
                  <FormLabel>Role Name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        ref={roleInputRef}
                        placeholder="e.g., Developer, Viewer, Support"
                        disabled={isPending || !!editingRole}
                        onFocus={() => setShowRoleSuggestions(true)}
                        onBlur={() => {
                          // Delay hiding to allow click on suggestions
                          setTimeout(() => setShowRoleSuggestions(false), 200);
                        }}
                        autoComplete="off"
                      />
                      {editingRole && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2"
                          onClick={() => {
                            resetForm();
                          }}
                        >
                          <Icon name="close" size={16} />
                        </Button>
                      )}
                    </div>
                  </FormControl>

                  {/* Role suggestions dropdown */}
                  {showRoleSuggestions &&
                    !editingRole &&
                    filteredRoles.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-auto">
                        <div className="p-1">
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            Existing roles (click to edit)
                          </div>
                          {filteredRoles.map((role) => (
                            <button
                              key={role.id || role.role}
                              type="button"
                              className="w-full flex items-center justify-between px-2 py-2 text-sm rounded hover:bg-accent cursor-pointer text-left"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                loadRoleForEditing(role);
                              }}
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">
                                  {role.label}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {role.allowsAllStaticPermissions
                                    ? "Full org access"
                                    : role.staticPermissionCount
                                      ? `${role.staticPermissionCount} org perm(s)`
                                      : "No org perms"}
                                  {" · "}
                                  {role.allowsAllConnections
                                    ? "All connections"
                                    : role.connectionCount
                                      ? `${role.connectionCount} connection(s)`
                                      : "No connections"}
                                </span>
                              </div>
                              <Icon
                                name="edit"
                                size={16}
                                className="text-muted-foreground"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  <FormDescription>
                    {editingRole
                      ? "Role name cannot be changed. Clear to create a new role."
                      : "Type to search existing roles or enter a new name."}
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
                        disabled={isPending}
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
                          disabled={isPending}
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
                        disabled={isPending}
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
                          disabled={isPending}
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
                        disabled={isPending}
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

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {editingRole && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (
                      editingRole.id &&
                      confirm(
                        `Are you sure you want to delete the "${editingRole.label}" role?`,
                      )
                    ) {
                      deleteRoleMutation.mutate(editingRole.id);
                    }
                  }}
                  disabled={isPending}
                  className="sm:mr-auto"
                >
                  {deleteRoleMutation.isPending ? "Deleting..." : "Delete Role"}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setOpen(false);
                }}
                type="button"
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !isFormValid}>
                {editingRole
                  ? updateRoleMutation.isPending
                    ? "Saving..."
                    : "Save Changes"
                  : createRoleMutation.isPending
                    ? "Creating..."
                    : "Create Role"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
