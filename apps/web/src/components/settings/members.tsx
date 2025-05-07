import { Suspense, useDeferredValue, useMemo, useState } from "react";
import {
  useAddTeamMember,
  useRemoveTeamMember,
  useTeamMembers,
  useTeams,
} from "@deco/sdk";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useForm } from "react-hook-form";
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
import { Icon } from "@deco/ui/components/icon.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";

import { Avatar } from "../common/Avatar.tsx";
import { timeAgo } from "../../utils/timeAgo.ts";
import { useCurrentTeam } from "../sidebar/TeamSelector.tsx";
import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";

// Form validation schema
const addMemberSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

type AddMemberFormData = z.infer<typeof addMemberSchema>;

function MemberTitle() {
  return (
    <div className="items-center justify-between hidden md:flex">
      <h2 className="text-2xl">Members</h2>
    </div>
  );
}

function MemberTableHeader(
  { onChange, disabled }: {
    disabled?: boolean;
    onChange: (value: string) => void;
  },
) {
  return (
    <div className="">
      <Input
        placeholder="Search"
        onChange={(e) => onChange(e.currentTarget.value)}
        className="w-80"
        disabled={disabled}
      />
    </div>
  );
}

function MembersViewLoading() {
  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <MemberTitle />
      <MemberTableHeader disabled onChange={() => {}} />
      <div className="flex justify-center p-8">
        <Spinner />
        <span className="ml-2">Loading members...</span>
      </div>
    </div>
  );
}

function AddTeamMemberButton({ teamId }: { teamId?: number }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const addMemberMutation = useAddTeamMember();

  const form = useForm<AddMemberFormData>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      email: "",
    },
  });

  // Add new member
  const handleAddMember = async (data: AddMemberFormData) => {
    if (!teamId) return;
    try {
      await addMemberMutation.mutateAsync({
        teamId,
        ...data,
      });

      // Reset form and close dialog
      form.reset();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Failed to add team member:", error);
    }
  };
  return (
    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <span className="sr-only">close add member dialog</span>
          <Icon name="add" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Team Member</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleAddMember)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter email address"
                      {...field}
                      autoComplete="email"
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
                  form.reset();
                  setIsAddDialogOpen(false);
                }}
                type="button"
                disabled={addMemberMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addMemberMutation.isPending ||
                  !form.formState.isValid}
              >
                {addMemberMutation.isPending ? "Adding..." : "Add Member"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function MembersViewContent() {
  const { teamSlug } = useCurrentTeam();
  const { data: teams } = useTeams();
  const teamId = useMemo(
    () => teams.find((team) => team.slug === teamSlug)?.id,
    [teams, teamSlug],
  );
  const { data: members } = useTeamMembers(teamId ?? null, {
    withActivity: true,
  });
  const removeMemberMutation = useRemoveTeamMember();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const filteredMembers = useMemo(
    () =>
      deferredQuery
        ? members.filter((member) =>
          member.profiles.metadata.full_name?.toLowerCase().includes(
            deferredQuery,
          ) ||
          member.profiles.email.toLowerCase().includes(deferredQuery)
        )
        : members,
    [members, deferredQuery],
  );

  const isMobile = useIsMobile();

  // Remove member
  const handleRemoveMember = async (memberId: number) => {
    if (!teamId) return;
    try {
      await removeMemberMutation.mutateAsync({
        teamId,
        memberId,
      });
    } catch (error) {
      console.error("Failed to remove team member:", error);
    }
  };

  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <MemberTitle />

      <div className="flex flex-col gap-4">
        <MemberTableHeader onChange={setQuery} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              {!isMobile && <TableHead>Last active</TableHead>}
              <TableHead className="w-[50px]">
                <AddTeamMemberButton teamId={teamId} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    No members found. Add team members to get started.
                  </TableCell>
                </TableRow>
              )
              : (
                filteredMembers.map((member) => (
                  <TableRow key={member.id} className="px-4 py-1.5">
                    <TableCell>
                      <span className="flex gap-2 items-center w-43 md:w-56">
                        <span>
                          <Avatar
                            url={member.profiles.metadata.avatar_url}
                            fallback={member.profiles.metadata.full_name}
                            className="w-8 h-8"
                          />
                        </span>

                        <span className="flex flex-col gap-1 min-w-0">
                          <span className="font-semibold text-xs truncate">
                            {member.profiles.metadata.full_name ||
                              member.profiles.email}
                          </span>
                          <span className="text-[10px] leading-3.5 text-slate-500 truncate">
                            {member.profiles.email || "N/A"}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      {member.admin ? "Admin" : "Member"}
                    </TableCell>
                    {!isMobile && (
                      <TableCell>
                        {member.lastActivity
                          ? timeAgo(member.lastActivity)
                          : "N/A"}
                      </TableCell>
                    )}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                          >
                            <span className="sr-only">Open menu</span>
                            <Icon name="more_horiz" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() =>
                              handleRemoveMember(member.id)}
                            disabled={removeMemberMutation.isPending}
                          >
                            <Icon name="delete" />
                            {removeMemberMutation.isPending &&
                                removeMemberMutation.variables?.memberId ===
                                  member.id
                              ? "Removing..."
                              : "Remove Member"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function MembersSettings() {
  return (
    <>
      <SettingsMobileHeader currentPage="members" />
      <Suspense fallback={<MembersViewLoading />}>
        <MembersViewContent />
      </Suspense>
    </>
  );
}
