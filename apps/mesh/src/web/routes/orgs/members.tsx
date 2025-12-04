import { authClient } from "@/web/lib/auth-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CollectionPage } from "@/web/components/collections/collection-page.tsx";
import { CollectionHeader } from "@/web/components/collections/collection-header.tsx";
import { CollectionSearch } from "@/web/components/collections/collection-search.tsx";
import { CollectionTableWrapper } from "@/web/components/collections/collection-table-wrapper.tsx";
import type { TableColumn } from "@deco/ui/components/collection-table.tsx";
import { Avatar } from "@deco/ui/components/avatar.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { toast } from "sonner";
import { KEYS } from "@/web/lib/query-keys";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { InviteMemberDialog } from "@/web/components/invite-member-dialog";
import { useState, useMemo } from "react";
import { EmptyState } from "@/web/components/empty-state.tsx";

const useMembers = () => {
  const { locator } = useProjectContext();
  return useQuery({
    queryKey: KEYS.members(locator),
    queryFn: () => authClient.organization.listMembers(),
  });
};

function getInitials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case "owner":
      return "default";
    case "admin":
      return "secondary";
    default:
      return "outline";
  }
}

interface MemberActionsDropdownProps {
  member: {
    id: string;
    role: string;
  };
  onChangeRole: (memberId: string, role: string) => void;
  onRemove: (memberId: string) => void;
  isUpdating?: boolean;
}

function MemberActionsDropdown({
  member,
  onChangeRole,
  onRemove,
  isUpdating = false,
}: MemberActionsDropdownProps) {
  const isOwner = member.role === "owner";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={isOwner}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="more_vert" size={20} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {member.role === "admin" ? (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onChangeRole(member.id, "member");
            }}
            disabled={isUpdating}
          >
            <Icon name="person" size={16} />
            Change to Member
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onChangeRole(member.id, "admin");
            }}
            disabled={isUpdating}
          >
            <Icon name="admin_panel_settings" size={16} />
            Change to Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(member.id);
          }}
        >
          <Icon name="delete" size={16} />
          Remove Member
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function OrgMembers() {
  const { data, isLoading } = useMembers();
  const queryClient = useQueryClient();
  const { locator } = useProjectContext();
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [sortKey, setSortKey] = useState<string>("member");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    "asc",
  );

  const members = data?.data?.members ?? [];

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) =>
        prev === "asc" ? "desc" : prev === "desc" ? null : "asc",
      );
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedMembers = useMemo(() => {
    let filtered = members;

    // Filter by search
    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(
        (member) =>
          member.user?.name?.toLowerCase().includes(lowerSearch) ||
          member.user?.email?.toLowerCase().includes(lowerSearch) ||
          member.role?.toLowerCase().includes(lowerSearch),
      );
    }

    // Sort
    if (sortKey && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string;
        let bVal: string;

        switch (sortKey) {
          case "member":
            aVal = a.user?.name || "";
            bVal = b.user?.name || "";
            break;
          case "role":
            aVal = a.role || "";
            bVal = b.role || "";
            break;
          case "joined":
            aVal = a.createdAt
              ? typeof a.createdAt === "string"
                ? a.createdAt
                : a.createdAt.toISOString()
              : "";
            bVal = b.createdAt
              ? typeof b.createdAt === "string"
                ? b.createdAt
                : b.createdAt.toISOString()
              : "";
            break;
          default:
            return 0;
        }

        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      });
    }

    return filtered;
  }, [members, search, sortKey, sortDirection]);

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const result = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
      });
      if (result?.error) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.members(locator) });
      toast.success("Member has been removed from the organization");
      setMemberToRemove(null);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove member",
      );
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: string;
    }) => {
      const result = await authClient.organization.updateMemberRole({
        memberId,
        role: [role],
      });
      if (result?.error) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.members(locator) });
      toast.success("Member's role has been updated");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update role",
      );
    },
  });

  type Member = (typeof members)[number];

  const columns: TableColumn<Member>[] = [
    {
      id: "member",
      header: "Member",
      render: (member) => (
        <div className="flex items-center gap-3">
          <Avatar
            url={member.user?.image ?? undefined}
            fallback={getInitials(member.user?.name)}
            shape="circle"
            size="sm"
          />
          <div>
            <div className="text-sm font-medium text-foreground">
              {member.user?.name || "Unknown"}
            </div>
            <div className="text-sm text-muted-foreground">
              {member.user?.email}
            </div>
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      id: "role",
      header: "Role",
      render: (member) => (
        <Badge variant={getRoleBadgeVariant(member.role)}>{member.role}</Badge>
      ),
      cellClassName: "w-[120px]",
      sortable: true,
    },
    {
      id: "joined",
      header: "Joined",
      render: (member) => (
        <span className="text-sm text-muted-foreground">
          {member.createdAt
            ? new Date(member.createdAt).toLocaleDateString()
            : "N/A"}
        </span>
      ),
      cellClassName: "w-[150px]",
      sortable: true,
    },
    {
      id: "actions",
      header: "",
      render: (member) => (
        <MemberActionsDropdown
          member={member}
          onChangeRole={(memberId, role) =>
            updateRoleMutation.mutate({ memberId, role })
          }
          onRemove={setMemberToRemove}
          isUpdating={updateRoleMutation.isPending}
        />
      ),
      cellClassName: "w-[60px]",
    },
  ];

  const ctaButton = (
    <InviteMemberDialog
      trigger={
        <Button size="sm" className="h-7 px-3 rounded-lg text-sm font-medium">
          Invite Member
        </Button>
      }
    />
  );

  return (
    <CollectionPage>
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={() => setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the organization?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                memberToRemove && removeMemberMutation.mutate(memberToRemove)
              }
              disabled={removeMemberMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CollectionHeader
        title="Members"
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        sortOptions={[
          { id: "member", label: "Name" },
          { id: "role", label: "Role" },
          { id: "joined", label: "Joined" },
        ]}
        ctaButton={ctaButton}
      />

      <CollectionSearch
        value={search}
        onChange={setSearch}
        placeholder="Search members..."
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setSearch("");
            (event.target as HTMLInputElement).blur();
          }
        }}
      />

      {viewMode === "cards" ? (
        <div className="flex-1 overflow-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : filteredAndSortedMembers.length === 0 ? (
            <EmptyState
              title={search ? "No members found" : "No members found"}
              description={
                search
                  ? `No members match "${search}"`
                  : "Invite members to get started."
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredAndSortedMembers.map((member) => (
                <Card key={member.id} className="transition-colors relative">
                  <div className="absolute top-4 right-4 z-10">
                    <MemberActionsDropdown
                      member={member}
                      onChangeRole={(memberId, role) =>
                        updateRoleMutation.mutate({ memberId, role })
                      }
                      onRemove={setMemberToRemove}
                      isUpdating={updateRoleMutation.isPending}
                    />
                  </div>
                  <div className="flex flex-col gap-4 p-6">
                    <Avatar
                      url={member.user?.image ?? undefined}
                      fallback={getInitials(member.user?.name)}
                      shape="circle"
                      size="lg"
                      className="shrink-0"
                    />
                    <div className="flex flex-col gap-2">
                      <h3 className="text-base font-medium text-foreground truncate">
                        {member.user?.name || "Unknown"}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.user?.email}
                      </p>
                      <Badge
                        variant={getRoleBadgeVariant(member.role)}
                        className="w-fit"
                      >
                        {member.role}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <CollectionTableWrapper
          columns={columns}
          data={filteredAndSortedMembers}
          isLoading={isLoading}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          emptyState={
            search ? (
              <EmptyState
                title="No members found"
                description={`No members match "${search}"`}
              />
            ) : (
              <EmptyState
                title="No members found"
                description="Invite members to get started."
              />
            )
          }
        />
      )}
    </CollectionPage>
  );
}
