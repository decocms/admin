import { Suspense, useMemo, useState } from "react";
import { useTeam, useTeamMembers, useTeamRoles } from "@deco/sdk/hooks";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useCurrentTeam } from "../../sidebar/team-selector.tsx";
import { useUser } from "../../../hooks/use-user.ts";
import { ListPageHeader } from "../../common/list-page-header.tsx";
import { MembersTableView } from "./table.tsx";
import { RolesTableView } from "./roles.tsx";

// Components
function MembersViewLoading({ loadingMessage }: { loadingMessage: string }) {
  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex justify-center p-8">
        <Spinner />
        <span className="ml-2">{loadingMessage}</span>
      </div>
    </div>
  );
}

function MembersViewContent({
  tab,
  onTabChange,
}: {
  tab: "members" | "roles";
  onTabChange: (tab: "members" | "roles") => void;
}) {
  const { slug } = useCurrentTeam();
  const { data: team } = useTeam(slug);
  const teamId = useMemo(() => team?.id, [team?.id]);
  const { data: roles = [] } = useTeamRoles(teamId ?? null);
  const {
    data: { members },
  } = useTeamMembers(teamId ?? null, {
    withActivity: true,
  });

  const user = useUser();

  // Memoized toggle items for stable references
  // Note: counts will be managed by child components
  const toggleItems = useMemo(
    () => [
      {
        id: "members",
        label: "Members",
        count: members.length,
        active: tab === "members",
      } as const,
      {
        id: "roles",
        label: "Roles",
        count: roles.length,
        active: tab === "roles",
      } as const,
    ],
    [tab, members.length, roles.length],
  );

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <ListPageHeader
          filter={{
            items: toggleItems,
            onClick: (item) => onTabChange(item.id),
          }}
        />

        {tab === "members" ? (
          <MembersTableView teamId={teamId} user={user} />
        ) : (
          <RolesTableView teamId={teamId} />
        )}
      </div>
    </div>
  );
}

export default function MembersSettings() {
  const [tab, setTab] = useState<"members" | "roles">("members");

  return (
    <ScrollArea className="h-full text-foreground">
      <Suspense
        fallback={
          <MembersViewLoading
            loadingMessage={
              tab === "members" ? "Loading members..." : "Loading roles..."
            }
          />
        }
      >
        <MembersViewContent tab={tab} onTabChange={setTab} />
      </Suspense>
    </ScrollArea>
  );
}
