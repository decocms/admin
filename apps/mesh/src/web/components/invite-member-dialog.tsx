import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { EmailTagsInput } from "@deco/ui/components/email-tags-input.tsx";
import { authClient } from "@/web/lib/auth-client";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { KEYS } from "@/web/lib/query-keys";
import { useOrganizationRoles } from "@/web/hooks/use-organization-roles";

interface InviteMemberDialogProps {
  trigger: React.ReactNode;
}

const emailSchema = z.string().email("Invalid email address");

type InviteMemberFormData = {
  emails: string[];
  role: string; // Single role selection
};

export function InviteMemberDialog({ trigger }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const { locator } = useProjectContext();
  const queryClient = useQueryClient();

  // Get the active organization from session
  const { data: session } = authClient.useSession();
  const currentUserEmail = session?.user?.email;

  // Get available roles
  const { roles: availableRoles, isLoading: isLoadingRoles } =
    useOrganizationRoles();

  // Filter out owner role from invite options
  const inviteableRoles = availableRoles.filter((r) => r.role !== "owner");

  const form = useForm<InviteMemberFormData>({
    mode: "onChange",
    defaultValues: {
      emails: [],
      role: "user", // Default to user role
    },
  });

  const emails = form.watch("emails");
  const selectedRole = form.watch("role");

  // Filter valid emails for submission
  const validEmails = emails.filter((email) => {
    const trimmedEmail = email.trim().toLowerCase();
    const isValidFormat = emailSchema.safeParse(trimmedEmail).success;
    const isNotSelf =
      !currentUserEmail || trimmedEmail !== currentUserEmail.toLowerCase();
    return isValidFormat && isNotSelf;
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteMemberFormData) => {
      if (!data.role) {
        throw new Error("Please select a role");
      }

      // Invite each valid email with the selected role
      const results = await Promise.allSettled(
        validEmails.map(async (email) => {
          const result = await authClient.organization.inviteMember({
            email,
            role: data.role as "admin" | "owner",
          });

          if (result.error) {
            throw new Error(result.error.message);
          }

          return result.data;
        }),
      );

      // Check for failures
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        throw new Error(
          `Failed to invite ${failures.length} member${failures.length > 1 ? "s" : ""}`,
        );
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.members(locator) });
      toast.success(
        validEmails.length === 1
          ? "Member invited successfully!"
          : `${validEmails.length} members invited successfully!`,
      );
      form.reset({
        emails: [],
        role: "user",
      });
      setOpen(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to invite members",
      );
    },
  });

  const handleSubmit = (data: InviteMemberFormData) => {
    if (validEmails.length === 0) {
      toast.error("Please add at least one valid email address");
      return;
    }
    if (!data.role) {
      toast.error("Please select a role");
      return;
    }
    inviteMutation.mutate(data);
  };

  const isFormValid = validEmails.length > 0 && !!selectedRole;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="emails"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <EmailTagsInput
                      emails={field.value ?? []}
                      onEmailsChange={field.onChange}
                      disabled={inviteMutation.isPending}
                      placeholder="Emails, comma separated"
                      validation={{ currentUserEmail }}
                      onToast={(msg, type) => toast[type](msg)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={inviteMutation.isPending || isLoadingRoles}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {inviteableRoles.map((role) => {
                          // Build description parts for custom roles
                          const parts: string[] = [];

                          if (!role.isBuiltin) {
                            // Static permissions
                            if (role.allowsAllStaticPermissions) {
                              parts.push("Full org access");
                            } else if (
                              role.staticPermissionCount &&
                              role.staticPermissionCount > 0
                            ) {
                              parts.push(
                                `${role.staticPermissionCount} org perm${role.staticPermissionCount !== 1 ? "s" : ""}`,
                              );
                            }

                            // Connection permissions
                            if (role.allowsAllConnections) {
                              parts.push("All connections");
                            } else if (
                              role.connectionCount &&
                              role.connectionCount > 0
                            ) {
                              parts.push(
                                `${role.connectionCount} connection${role.connectionCount !== 1 ? "s" : ""}`,
                              );
                            }

                            // Tool permissions
                            if (
                              role.connectionCount !== 0 ||
                              role.allowsAllConnections
                            ) {
                              if (role.allowsAllTools) {
                                parts.push("all tools");
                              } else if (role.toolCount && role.toolCount > 0) {
                                parts.push(
                                  `${role.toolCount} tool${role.toolCount !== 1 ? "s" : ""}`,
                                );
                              }
                            }
                          }

                          return (
                            <SelectItem key={role.role} value={role.role}>
                              <div className="flex flex-col">
                                <span>{role.label}</span>
                                {!role.isBuiltin && parts.length > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {parts.join(", ")}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  form.reset({
                    emails: [],
                    role: "user",
                  });
                  setOpen(false);
                }}
                type="button"
                disabled={inviteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={inviteMutation.isPending || !isFormValid}
              >
                {inviteMutation.isPending
                  ? "Inviting..."
                  : `Invite ${validEmails.length || 0} Member${
                      validEmails.length !== 1 ? "s" : ""
                    }`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
