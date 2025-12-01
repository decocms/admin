import { useMemo, useState } from "react";
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
import { MultiSelect } from "@deco/ui/components/multi-select.tsx";
import { EmailTagsInput } from "@deco/ui/components/email-tags-input.tsx";
import { authClient } from "@/web/lib/auth-client";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { KEYS } from "@/web/lib/query-keys";

interface InviteMemberDialogProps {
  trigger: React.ReactNode;
}

const emailSchema = z.string().email("Invalid email address");

type InviteMemberFormData = {
  emails: string[];
  roles: string[]; // Support multiple roles like apps/web
};

export function InviteMemberDialog({ trigger }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const { locator } = useProjectContext();
  const queryClient = useQueryClient();

  // Get the active organization from session
  const { data: session } = authClient.useSession();
  const currentUserEmail = session?.user?.email;

  const form = useForm<InviteMemberFormData>({
    mode: "onChange",
    defaultValues: {
      emails: [],
      roles: ["member"], // Default to member role
    },
  });

  const emails = form.watch("emails");

  // Filter valid emails for submission
  const validEmails = useMemo(() => {
    return emails.filter((email) => {
      const trimmedEmail = email.trim().toLowerCase();
      const isValidFormat = emailSchema.safeParse(trimmedEmail).success;
      const isNotSelf =
        !currentUserEmail || trimmedEmail !== currentUserEmail.toLowerCase();
      return isValidFormat && isNotSelf;
    });
  }, [emails, currentUserEmail]);

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteMemberFormData) => {
      if (data.roles.length === 0) {
        throw new Error("Please select at least one role");
      }

      // Note: Better Auth's inviteMember accepts a single role
      // Using the first selected role for now
      const role = data.roles[0] as "member" | "admin" | "owner";

      // Invite each valid email
      const results = await Promise.allSettled(
        validEmails.map(async (email) => {
          const result = await authClient.organization.inviteMember({
            email,
            role,
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
        roles: ["member"],
      });
      setOpen(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to invite members",
      );
    },
  });

  const roles = form.watch("roles");

  const handleSubmit = (data: InviteMemberFormData) => {
    if (validEmails.length === 0) {
      toast.error("Please add at least one valid email address");
      return;
    }
    if (data.roles.length === 0) {
      toast.error("Please select at least one role");
      return;
    }
    inviteMutation.mutate(data);
  };

  const isFormValid = validEmails.length > 0 && roles.length > 0;

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
                      emails={field.value}
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
              name="roles"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <MultiSelect
                      options={[
                        { value: "member", label: "Member" },
                        { value: "admin", label: "Admin" },
                      ]}
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      placeholder="Select roles"
                      variant="secondary"
                      className="w-full max-w-none"
                      disabled={inviteMutation.isPending}
                      maxCount={99}
                    />
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
                    roles: ["member"],
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
