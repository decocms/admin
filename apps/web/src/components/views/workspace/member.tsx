import { Suspense, useDeferredValue, useMemo, useState } from "react";
import {
  type Member,
  useAddTeamMember,
  useRemoveTeamMember,
  useTeamMembers,
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
  DialogDescription,
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
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

import { Avatar } from "../../common/Avatar.tsx";

// Form validation schema
const addMemberSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

type AddMemberFormData = z.infer<typeof addMemberSchema>;

interface MembersViewProps {
  teamId: number;
}

function MembersViewLoading() {
  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Team Members</h2>
        <Button variant="default" size="icon" disabled>
          <span className="sr-only">Add member</span>
          <Icon name="add" />
        </Button>
      </div>
      <div className="flex justify-center p-8">
        <Spinner />
        <span className="ml-2">Loading members...</span>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="rounded-md bg-red-50 p-4 my-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            Error loading team members
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{error.message || "An unexpected error occurred"}</p>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="bg-red-50 text-red-800 hover:bg-red-100"
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddTeamMemberButton({ teamId }: { teamId: number }) {
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
          <span className="sr-only">Add member</span>
          <Icon name="add" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Team Member</DialogTitle>
          <DialogDescription>
            Enter their email.
          </DialogDescription>
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

function MembersViewContent({ teamId }: MembersViewProps) {
  const { data: members } = useTeamMembers(teamId);
  const removeMemberMutation = useRemoveTeamMember();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const filteredMembers = useMemo(
    () =>
      deferredQuery
        ? members.filter((member) =>
          member.profiles.name.toLowerCase().includes(deferredQuery) ||
          member.profiles.email.toLowerCase().includes(deferredQuery)
        )
        : members,
    [members, deferredQuery],
  );

  // Remove member
  const handleRemoveMember = async (memberId: number) => {
    try {
      await removeMemberMutation.mutateAsync({
        teamId,
        memberId,
      });
    } catch (error) {
      console.error("Failed to remove team member:", error);
    }
  };

  // Format date to a more readable format
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl">Members</h2>
      </div>

      <div className="flex flex-col gap-4">
        <div className="">
          <Input
            placeholder="Search"
            onChange={(e) => setQuery(e.currentTarget.value)}
            className="w-80"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Last active</TableHead>
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
                      <span className="flex gap-2 items-center">
                        <span>
                          <Avatar
                            url="todo"
                            fallback={member.profiles.name}
                            className="w-8 h-8"
                          />
                        </span>

                        <span className="flex flex-col gap-1 w-80">
                          <span className="font-semibold text-xs truncate">
                            {member.profiles.name || "N/A"}
                          </span>
                          <span className="text-[10px] leading-3.5 text-slate-500 truncate">
                            {member.profiles.email || "N/A"}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>fix: {formatDate(member.created_at)}</TableCell>
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

export default function MembersView({ teamId }: MembersViewProps) {
  return (
    <Suspense fallback={<MembersViewLoading />}>
      <MembersViewContent teamId={teamId} />
    </Suspense>
  );
}
