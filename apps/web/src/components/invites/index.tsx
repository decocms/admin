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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { timeAgo } from "../../utils/time-ago.ts";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { EmptyState } from "../common/empty-state.tsx";

function InvitesListSkeleton() {
  return (
    <div className="flex flex-col gap-4 h-full p-4">
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="flex items-center gap-2"></div>
        <div className="flex items-center gap-2 justify-self-auto md:justify-self-end p-1">
          <div className="w-80 h-10 bg-muted rounded-md animate-pulse"></div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse w-48"></div>
                <div className="h-3 bg-muted rounded animate-pulse w-32"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-16 bg-muted rounded animate-pulse"></div>
                <div className="h-8 w-16 bg-muted rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InvitesListEmpty() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 h-full p-4">
      <ListPageHeader
        input={{
          placeholder: "Search invitations",
          value: "",
          onChange: () => {},
          disabled: true,
        }}
      />
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <EmptyState
          icon="mail"
          title="No Invitations"
          description="You don't have any pending team invitations."
        />
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
  const [loadingStates, setLoadingStates] = useState<Record<string, "accept" | "reject" | null>>({});

  const filteredInvites = search.trim().length > 0
    ? invites.filter((invite) =>
        invite.teamName.toLowerCase().includes(search.toLowerCase()) ||
        (invite.inviter.name && invite.inviter.name.toLowerCase().includes(search.toLowerCase())) ||
        (invite.inviter.email && invite.inviter.email.toLowerCase().includes(search.toLowerCase()))
      )
    : invites;

  if (!invites.length) {
    return <InvitesListEmpty />;
  }

  const handleAccept = async (inviteId: string) => {
    setLoadingStates(prev => ({ ...prev, [inviteId]: "accept" }));
    try {
      const result = await acceptInviteMutation.mutateAsync(inviteId);

      if (!result.teamId) {
        toast.error("Failed to get team information");
        navigate("/");
        return;
      }

      const teamSlug = result.teamSlug;

      if (teamSlug) {
        navigate(`/${teamSlug}/agents`);
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("Accept invitation error:", error);
      toast.error("Failed to accept invitation");
    } finally {
      setLoadingStates(prev => ({ ...prev, [inviteId]: null }));
    }
  };

  const handleReject = async (id: string) => {
    setLoadingStates(prev => ({ ...prev, [id]: "reject" }));
    try {
      await rejectInviteMutation.mutateAsync({ id });
      toast.success("Invitation rejected");
    } catch (error) {
      console.error("Reject invitation error:", error);
      toast.error("Failed to reject invitation");
    } finally {
      setLoadingStates(prev => ({ ...prev, [id]: null }));
    }
  };

  function getSortValue(invite: Invite, key: string): string {
    if (key === "teamName") return invite.teamName.toLowerCase();
    if (key === "inviter") return (invite.inviter.name || invite.inviter.email || "").toLowerCase();
    if (key === "createdAt") return invite.createdAt;
    return "";
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  const sortedInvites = [...filteredInvites].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

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
              onClick={() => handleAccept(invite.id)}
              disabled={isAnyLoading}
              size="sm"
              className="h-8"
            >
              {isAcceptLoading
                ? <Spinner size="xs" />
                : <Icon name="check" className="mr-1" size={14} />}
              Accept
            </Button>
            <Button
              onClick={() => handleReject(invite.id)}
              disabled={isAnyLoading}
              variant="outline"
              size="sm"
              className="h-8"
            >
              {isRejectLoading
                ? <Spinner size="xs" />
                : <Icon name="close" className="mr-1" size={14} />}
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4 h-full p-4">
      <ListPageHeader
        input={{
          placeholder: "Search invitations",
          value: search,
          onChange: (e) => setSearch(e.target.value),
        }}
      />

      <div className="flex-1 min-h-0 overflow-x-auto">
        <Table
          columns={columns}
          data={sortedInvites}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      </div>
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

const TABS = {
  list: {
    Component: InvitesListWrapper,
    title: "Team Invitations",
    initialOpen: true,
  },
};

export default function InvitesList() {
  return (
    <PageLayout
      hideViewsButton
      tabs={TABS}
      breadcrumb={
        <DefaultBreadcrumb items={[{ label: "Team Invitations", link: "/invites" }]} />
      }
    />
  );
}
