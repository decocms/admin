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
import { Input } from "@deco/ui/components/input.tsx";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Protect } from "../wallet/plan.tsx";

// Form validation schema
const inviteMemberSchema = z.object({
  invitees: z.array(
    z.object({
      email: z.string().email({
        message: "Please enter a valid email address",
      }),
      roleId: z.string().min(1, { message: "Please select a role" }),
    }),
  ).min(1),
});

export type InviteMemberFormData = z.infer<typeof inviteMemberSchema>;

function InviteTeamMembersDialogFeatureWall() {
  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Invite Team Members</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center justify-center gap-6 py-8">
        <div className="rounded-full bg-slate-100 p-4 w-16 h-16 flex items-center justify-center">
          <Icon name="lock" className="text-slate-400" size={24} />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-slate-900">
            Upgrade Required
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Inviting team members is only available on paid workspaces
          </p>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button
            variant="outline"
            type="button"
          >
            Close
          </Button>
        </DialogClose>
        <Button
          variant="default"
          onClick={() => globalThis.open("https://deco.io/contact", "_blank")}
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
  trigger: React.ReactNode;
  onComplete?: () => void;
}

export function InviteTeamMembersDialog({
  teamId,
  trigger,
  onComplete,
}: InviteTeamMembersDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

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
  const ownerRoleId = useMemo(() => {
    const ownerRole = roles.find((role) => role.name.toLowerCase() === "owner");
    return ownerRole?.id.toString() || "";
  }, [roles]);

  const form = useForm<InviteMemberFormData>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      invitees: [{ email: "", roleId: ownerRoleId || "" }],
    },
  });

  useEffect(() => {
    if (ownerRoleId) {
      form.setValue("invitees.0.roleId", ownerRoleId);
    }
  }, [ownerRoleId, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "invitees",
  });

  // Add new invitee
  const handleAddInvitee = () => {
    append({ email: "", roleId: ownerRoleId });
  };

  // Remove invitee
  const handleRemoveInvitee = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  // Invite team members
  const handleInviteMembers = async (data: InviteMemberFormData) => {
    if (!teamId) return;
    try {
      // Transform data for API call
      const invitees = data.invitees.map(({ email, roleId }) => ({
        email,
        roles: [{
          id: Number(roleId),
          name: roles.find((r) => r.id === Number(roleId))?.name || "",
        }],
      }));

      // Call API to invite members
      await inviteMemberMutation.mutateAsync({
        teamId,
        invitees,
      });

      // Reset form and close dialog
      form.reset();
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
  const wrappedTrigger = cloneElement(
    trigger as ReactElement<{ onClick?: MouseEventHandler }>,
    {
      onClick: openDialog,
    },
  );

  return (
    <>
      {wrappedTrigger}
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <Protect
          feature="invite-to-workspace"
          fallback={<InviteTeamMembersDialogFeatureWall />}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Invite Team Members</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleInviteMembers)}
                className="space-y-6"
              >
                <div className="space-y-6">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex gap-3 items-start border-b pb-5 mb-2"
                    >
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name={`invitees.${index}.email`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter email address"
                                  {...field}
                                  autoComplete="email"
                                  disabled={inviteMemberMutation.isPending}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`invitees.${index}.roleId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={inviteMemberMutation.isPending}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {roles.map((role) => (
                                    <SelectItem
                                      key={role.id}
                                      value={role.id.toString()}
                                    >
                                      {role.name.charAt(0).toUpperCase() +
                                        role.name.slice(1)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="self-end mb-1"
                        onClick={() => handleRemoveInvitee(index)}
                        disabled={fields.length <= 1 ||
                          inviteMemberMutation.isPending}
                      >
                        <Icon name="remove" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={handleAddInvitee}
                    disabled={inviteMemberMutation.isPending}
                  >
                    <Icon name="add" className="mr-2" />
                    Add another invitee
                  </Button>
                </div>

                <div className="text-sm text-slate-500 mt-4 border-t pt-4">
                  Users will receive an invite email to join this team.
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      form.reset();
                      setIsOpen(false);
                    }}
                    type="button"
                    disabled={inviteMemberMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={inviteMemberMutation.isPending ||
                      !form.formState.isValid}
                  >
                    {inviteMemberMutation.isPending
                      ? "Inviting..."
                      : "Invite Members"}
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
