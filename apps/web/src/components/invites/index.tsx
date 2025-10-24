import { Suspense, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "@deco/ui/components/sonner.tsx";
import {
  type Invite,
  useAcceptInvite,
  useInvites,
  useRejectInvite,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Card } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { timeAgo } from "../../utils/time-ago.ts";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { TopbarLayout } from "../layout/home.tsx";

function InviteCard({
  invite,
  onAccept,
  onReject,
  isAcceptLoading,
  isRejectLoading,
  isAnyLoading,
}: {
  invite: Invite;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  isAcceptLoading: boolean;
  isRejectLoading: boolean;
  isAnyLoading: boolean;
}) {
  return (
    <Card className="group cursor-default hover:shadow-sm transition-shadow overflow-hidden bg-card border-0 min-h-48">
      <div className="flex flex-col h-full">
        {/* Content Section */}
        <div className="p-5 flex flex-col gap-3 flex-1">
          <h3 className="text-base font-medium text-foreground">
            {invite.teamName}
          </h3>

          <div className="flex gap-1 flex-wrap">
            {invite.roles.map((role) => (
              <Badge key={role.id} variant="secondary" className="text-xs">
                {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="relative w-5 h-5 rounded-full overflow-hidden bg-muted">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                  invite.inviter.name || invite.inviter.email || "Unknown",
                )}&size=20`}
                alt="Inviter avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-sm">
              {invite.inviter.name || invite.inviter.email || "Unknown"}
            </span>
          </div>
        </div>

        {/* Footer Section */}
        <div className="border-t border-border px-5 py-3 flex items-center justify-between shrink-0">
          <span className="text-sm text-muted-foreground">
            {timeAgo(invite.createdAt)}
          </span>

          <div className="flex gap-2">
            <Button
              onClick={() => onReject(invite.id)}
              disabled={isAnyLoading}
              variant="ghost"
              size="sm"
              className="h-8"
            >
              {isRejectLoading ? (
                <Spinner size="xs" />
              ) : (
                <>
                  <Icon name="close" className="mr-1.5" size={16} />
                  Decline
                </>
              )}
            </Button>
            <Button
              onClick={() => onAccept(invite.id)}
              disabled={isAnyLoading}
              variant="special"
              size="sm"
              className="h-8"
            >
              {isAcceptLoading ? (
                <Spinner size="xs" />
              ) : (
                <>
                  <Icon name="check" className="mr-1.5" size={16} />
                  Accept
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function InvitesListSkeleton() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div className="sticky left-0 px-4 lg:px-6 xl:px-10 pt-12 pb-4 md:pb-6 lg:pb-8 z-10 bg-background">
          <div className="max-w-[1600px] mx-auto w-full">
            <div className="h-8 bg-muted rounded animate-pulse w-64 mb-6"></div>
          </div>
        </div>
        <div className="px-4 lg:px-6 xl:px-10">
          <div className="max-w-[1600px] mx-auto w-full pb-8">
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              }}
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <Card
                  key={index}
                  className="overflow-hidden bg-card border-0 min-h-48"
                >
                  <div className="p-5 flex flex-col gap-3 flex-1">
                    <div className="h-6 bg-muted rounded animate-pulse w-3/4"></div>
                    <div className="flex gap-1">
                      <div className="h-5 bg-muted rounded animate-pulse w-16"></div>
                      <div className="h-5 bg-muted rounded animate-pulse w-20"></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-muted rounded-full animate-pulse"></div>
                      <div className="h-4 bg-muted rounded animate-pulse w-32"></div>
                    </div>
                  </div>
                  <div className="border-t border-border px-5 py-3 flex items-center justify-between">
                    <div className="h-4 bg-muted rounded animate-pulse w-20"></div>
                    <div className="flex gap-2">
                      <div className="h-8 bg-muted rounded animate-pulse w-20"></div>
                      <div className="h-8 bg-muted rounded animate-pulse w-16"></div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvitesListEmpty() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div className="sticky left-0 px-4 lg:px-6 xl:px-10 pt-12 pb-4 md:pb-6 lg:pb-8 z-10 bg-background">
          <div className="max-w-[1600px] mx-auto w-full">
            <h1 className="text-2xl font-semibold">Team Invitations</h1>
          </div>
        </div>
        <div className="px-4 lg:px-6 xl:px-10">
          <div className="max-w-[1600px] mx-auto w-full pb-8 flex items-center justify-center min-h-96">
            <EmptyState
              icon="move_to_inbox"
              title="No Invitations"
              description="You don't have any pending team invitations."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InvitesListContent() {
  const { data: invites = [] } = useInvites();
  const acceptInviteMutation = useAcceptInvite();
  const rejectInviteMutation = useRejectInvite();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("teamName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [loadingStates, setLoadingStates] = useState<
    Record<string, "accept" | "reject" | null>
  >({});
  const [viewMode, setViewMode] = useViewMode("invites");

  const filteredInvites =
    search.trim().length > 0
      ? invites.filter(
          (invite) =>
            invite.teamName.toLowerCase().includes(search.toLowerCase()) ||
            (invite.inviter.name &&
              invite.inviter.name
                .toLowerCase()
                .includes(search.toLowerCase())) ||
            (invite.inviter.email &&
              invite.inviter.email
                .toLowerCase()
                .includes(search.toLowerCase())),
        )
      : invites;

  if (!invites.length) {
    return <InvitesListEmpty />;
  }

  const handleAccept = async (inviteId: string) => {
    setLoadingStates((prev) => ({ ...prev, [inviteId]: "accept" }));
    try {
      const result = await acceptInviteMutation.mutateAsync(inviteId);

      const org = result.teamSlug;
      if (!result.ok || !org) {
        throw new Error("Failed to accept invitation. Please try again.");
      }

      navigate(`/${org}`);
    } catch (error) {
      console.error("Accept invitation error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to accept invitation. Please try again.",
      );
    } finally {
      setLoadingStates((prev) => ({ ...prev, [inviteId]: null }));
    }
  };

  const handleReject = async (inviteId: string) => {
    setLoadingStates((prev) => ({ ...prev, [inviteId]: "reject" }));
    try {
      await rejectInviteMutation.mutateAsync({ id: inviteId });
      toast.success("Invitation rejected");
    } catch (error) {
      console.error("Reject invitation error:", error);
      toast.error("Failed to reject invitation");
    } finally {
      setLoadingStates((prev) => ({ ...prev, [inviteId]: null }));
    }
  };

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  function getSortValue(invite: Invite, key: string): string {
    switch (key) {
      case "teamName":
        return invite.teamName.toLowerCase();
      case "inviter":
        return (
          invite.inviter.name ||
          invite.inviter.email ||
          ""
        ).toLowerCase();
      case "createdAt":
        return invite.createdAt;
      default:
        return "";
    }
  }

  const sortedInvites = [...filteredInvites].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        {/* Header Section */}
        <div className="sticky left-0 px-4 lg:px-6 xl:px-10 pt-12 pb-4 md:pb-6 lg:pb-8 z-10 bg-background">
          <div className="max-w-[1600px] mx-auto w-full">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold">Team Invitations</h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-9 h-9"
                  onClick={() =>
                    setViewMode(viewMode === "cards" ? "table" : "cards")
                  }
                >
                  <Icon
                    name={viewMode === "cards" ? "table_rows" : "grid_view"}
                    size={20}
                    className="text-muted-foreground"
                  />
                </Button>
              </div>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search invitations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-md px-4 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="px-4 lg:px-6 xl:px-10">
          <div className="max-w-[1600px] mx-auto w-full pb-8">
            {viewMode === "table" ? (
              <div className="w-fit min-w-full">
                <TableView
                  invites={sortedInvites}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  loadingStates={loadingStates}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </div>
            ) : (
              <CardsView
                invites={sortedInvites}
                onAccept={handleAccept}
                onReject={handleReject}
                loadingStates={loadingStates}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TableView({
  invites,
  onAccept,
  onReject,
  loadingStates,
  sortKey,
  sortDirection,
  onSort,
}: {
  invites: Invite[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  loadingStates: Record<string, "accept" | "reject" | null>;
  sortKey: string;
  sortDirection: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  const columns: TableColumn<Invite>[] = [
    {
      id: "teamName",
      header: "Team",
      render: (invite) => (
        <span className="font-medium">{invite.teamName}</span>
      ),
      sortable: true,
    },
    {
      id: "inviter",
      header: "Invited By",
      render: (invite) => (
        <span>{invite.inviter.name || invite.inviter.email || "Unknown"}</span>
      ),
      sortable: true,
    },
    {
      id: "roles",
      header: "Role",
      render: (invite) => (
        <div className="flex gap-1 flex-wrap">
          {invite.roles.map((role) => (
            <Badge key={role.id} variant="outline" className="text-xs">
              {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "createdAt",
      header: "Invited",
      render: (invite) => (
        <span className="text-sm text-muted-foreground">
          {timeAgo(invite.createdAt)}
        </span>
      ),
      sortable: true,
    },
    {
      id: "actions",
      header: "",
      render: (invite) => {
        const loading = loadingStates[invite.id];
        const isAcceptLoading = loading === "accept";
        const isRejectLoading = loading === "reject";
        const isAnyLoading = isAcceptLoading || isRejectLoading;

        return (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              onClick={() => onReject(invite.id)}
              disabled={isAnyLoading}
              variant="ghost"
              size="sm"
              className="h-8"
            >
              {isRejectLoading ? (
                <Spinner size="xs" />
              ) : (
                <>
                  <Icon name="close" className="mr-1.5" size={16} />
                  Decline
                </>
              )}
            </Button>
            <Button
              onClick={() => onAccept(invite.id)}
              disabled={isAnyLoading}
              variant="special"
              size="sm"
              className="h-8"
            >
              {isAcceptLoading ? (
                <Spinner size="xs" />
              ) : (
                <>
                  <Icon name="check" className="mr-1.5" size={16} />
                  Accept
                </>
              )}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <Table
      columns={columns}
      data={invites}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={onSort}
    />
  );
}

function CardsView({
  invites,
  onAccept,
  onReject,
  loadingStates,
}: {
  invites: Invite[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  loadingStates: Record<string, "accept" | "reject" | null>;
}) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
      }}
    >
      {invites.map((invite) => {
        const loading = loadingStates[invite.id];
        const isAcceptLoading = loading === "accept";
        const isRejectLoading = loading === "reject";
        const isAnyLoading = isAcceptLoading || isRejectLoading;

        return (
          <InviteCard
            key={invite.id}
            invite={invite}
            onAccept={onAccept}
            onReject={onReject}
            isAcceptLoading={isAcceptLoading}
            isRejectLoading={isRejectLoading}
            isAnyLoading={isAnyLoading}
          />
        );
      })}
    </div>
  );
}

function InvitesListWrapper() {
  return (
    <Suspense fallback={<InvitesListSkeleton />}>
      <InvitesListContent />
    </Suspense>
  );
}

export default function InvitesList() {
  return (
    <TopbarLayout
      breadcrumb={[{ label: "Team Invitations", link: "/invites" }]}
    >
      <InvitesListWrapper />
    </TopbarLayout>
  );
}
