import type React from "react";
import {
  cloneElement,
  type MouseEventHandler,
  type ReactElement,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useInviteTeamMember, useTeamRoles } from "@deco/sdk";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Protect } from "../wallet/plan.tsx";
import { useContactUsUrl } from "../../hooks/use-contact-us.ts";
import { MultiSelect } from "@deco/ui/components/multi-select.tsx";
import { EmailTagsInput } from "@deco/ui/components/email-tags-input.tsx";
import { useUser } from "../../hooks/use-user.ts";

// Form validation schema - simplified for email tags approach
const inviteMemberSchema = z.object({
  emails: z
    .array(z.string().email("Invalid email address"))
    .min(1, "At least one email is required"),
  roleId: z.array(z.string()).min(1, { message: "Please select a role" }),
});

export type InviteMemberFormData = z.infer<typeof inviteMemberSchema>;

const emailSchema = z.string().email("Invalid email address");

function InviteTeamMembersDialogFeatureWall() {
  const contactUsUrl = useContactUsUrl();
  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Invite members</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center justify-center gap-6 py-8">
        <div className="rounded-full bg-muted p-4 w-16 h-16 flex items-center justify-center">
          <Icon name="lock" className="text-muted-foreground" size={24} />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground">
            Upgrade Required
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-2/3 mx-auto">
            This team has reached its seat limit. Upgrade your plan to invite
            more members.
          </p>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">
            Close
          </Button>
        </DialogClose>
        <Button
          variant="default"
          onClick={() => globalThis.open(contactUsUrl, "_blank")}
          type="button"
        >
          Contact Us
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

interface InviteTeamMembersDialogProps {
  teamId?: number;
  trigger?: React.ReactNode;
  onComplete?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function InviteTeamMembersDialog({
  teamId,
  trigger,
  onComplete,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: InviteTeamMembersDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const user = useUser();

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange || setInternalOpen;

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const openDialog = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTimeout(() => {
      setIsOpen(true);
    }, 50);
  };

  const inviteMemberMutation = useInviteTeamMember();
  const { data: roles = [] } = useTeamRoles(teamId ?? null);

  // Find collaborator role as default (instead of owner)
  const collaboratorRoleId = useMemo(() => {
    const collaboratorRole = roles.find(
      (role) => role.name.toLowerCase() === "collaborator",
    );
    return collaboratorRole?.id.toString() || "";
  }, [roles]);

  // Custom schema that doesn't show "At least one email is required" error
  const customInviteMemberSchema = z.object({
    emails: z.array(z.string()),
    roleId: z.array(z.string()).min(1, { message: "Please select a role" }),
  });

  const form = useForm<{ emails: string[]; roleId: string[] }>({
    resolver: zodResolver(customInviteMemberSchema),
    mode: "onChange", // Changed to onChange for better validation feedback
    defaultValues: {
      emails: [],
      roleId: collaboratorRoleId ? [collaboratorRoleId] : [],
    },
  });

  useEffect(() => {
    if (collaboratorRoleId) {
      form.setValue("roleId", [collaboratorRoleId]);
    }
  }, [collaboratorRoleId, form]);

  // Watch form values for better reactivity
  const emails = form.watch("emails");
  const roleIds = form.watch("roleId");

  // Filter valid emails for submission
  const validEmails = useMemo(() => {
    return emails.filter((email) => {
      const trimmedEmail = email.trim().toLowerCase();

      const isValidFormat = emailSchema.safeParse(trimmedEmail).success;
      const isNotSelf =
        !user?.email || trimmedEmail !== user.email.toLowerCase();
      return isValidFormat && isNotSelf;
    });
  }, [emails, user?.email]);

  // Invite team members
  const handleInviteMembers = async (data: {
    emails: string[];
    roleId: string[];
  }) => {
    if (!teamId) return;

    if (validEmails.length === 0) {
      toast.error("Please add at least one valid email address");
      return;
    }

    try {
      // Transform data for API call - only use valid emails
      const invitees = validEmails.map((email) => ({
        email,
        roles: data.roleId.map((id) => ({
          id: Number(id),
          name: roles.find((r) => r.id === Number(id))?.name || "",
        })),
      }));

      // Call API to invite members
      await inviteMemberMutation.mutateAsync({
        teamId,
        invitees,
      });

      // Reset form and close dialog
      form.reset({
        emails: [],
        roleId: collaboratorRoleId ? [collaboratorRoleId] : [],
      });
      setIsOpen(false);
      toast.success(
        invitees.length === 1
          ? "Team member invited successfully!"
          : `${invitees.length} team members invited successfully!`,
      );

      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error("Failed to invite team members:", error);
    }
  };

  // Create a cloned trigger with an onClick handler
  const wrappedTrigger = trigger
    ? cloneElement(trigger as ReactElement<{ onClick?: MouseEventHandler }>, {
        onClick: openDialog,
      })
    : null;

  // Role options for MultiSelect
  const roleOptions = useMemo(
    () =>
      roles.map((role) => ({
        label: role.name,
        value: role.id.toString(),
      })),
    [roles],
  );

  // Check if form is valid for submit button - use valid emails count
  const isFormValid = validEmails.length > 0 && roleIds.length > 0;

  return (
    <>
      {wrappedTrigger}
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <Protect
          check={(plan) => !plan.isAtSeatLimit}
          fallback={<InviteTeamMembersDialogFeatureWall />}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Invite members</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleInviteMembers)}
                className="space-y-4"
              >
                <div className="space-y-4">
                  {/* Email Tags Input - no label or description */}
                  <FormField
                    control={form.control}
                    name="emails"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <EmailTagsInput
                            emails={field.value ?? []}
                            onEmailsChange={field.onChange}
                            disabled={inviteMemberMutation.isPending}
                            placeholder="Emails, comma separated"
                            validation={{ currentUserEmail: user?.email }}
                            onToast={(msg, type) => toast[type](msg)}
                          />
                        </FormControl>
                        {/* Don't show FormMessage to avoid "At least one email is required" */}
                      </FormItem>
                    )}
                  />

                  {/* Role Selection using MultiSelect - full width */}
                  <FormField
                    control={form.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <MultiSelect
                            options={roleOptions}
                            defaultValue={field.value}
                            onValueChange={field.onChange}
                            placeholder="Select roles"
                            variant="secondary"
                            className="w-full max-w-none"
                            disabled={inviteMemberMutation.isPending}
                            maxCount={99} // Show all tags that fit
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      form.reset({
                        emails: [],
                        roleId: collaboratorRoleId ? [collaboratorRoleId] : [],
                      });
                      setIsOpen(false);
                    }}
                    type="button"
                    disabled={inviteMemberMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={inviteMemberMutation.isPending || !isFormValid}
                  >
                    {inviteMemberMutation.isPending
                      ? "Inviting..."
                      : `Invite ${validEmails.length || 0} Member${
                          validEmails.length !== 1 ? "s" : ""
                        }`}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Protect>
      </Dialog>
    </>
  );
}
