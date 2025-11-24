import { useOrganizations, useTeam } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { ResponsiveDropdownItem } from "@deco/ui/components/responsive-dropdown.tsx";
import { Link, useParams } from "react-router";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { Avatar } from "@deco/ui/components/avatar.tsx";
import {
  type Theme,
  type View,
  withDefaultViews,
  type Resource,
} from "@deco/sdk";

export interface CurrentTeam {
  avatarUrl: string | undefined;
  slug: string;
  id: number | string;
  label: string;
  theme: Theme | undefined;
}

export function useCurrentTeam(): CurrentTeam & {
  views: View[];
  resources: Resource[];
} {
  const { org } = useParams();
  const { data: teamData } = useTeam(org);

  if (!org) {
    throw new Error("No organization found");
  }

  return {
    avatarUrl: teamData?.avatar_url,
    label: teamData?.name || org || "",
    id: teamData?.id ?? "",
    slug: teamData?.slug ?? org ?? "",
    theme: teamData?.theme,
    views: withDefaultViews(teamData?.views ?? []),
    resources: teamData?.resources ?? [],
  };
}

function CurrentTeamDropdownOptions({
  onRequestInvite,
}: {
  onRequestInvite: () => void;
}) {
  const buildWorkspaceLink = useWorkspaceLink();

  return (
    <>
      <ResponsiveDropdownItem asChild>
        <Link
          to={buildWorkspaceLink("/settings")}
          className="w-full flex items-center gap-2 cursor-pointer"
        >
          <span className="grid place-items-center p-1">
            <Icon name="settings" size={18} className="text-muted-foreground" />
          </span>
          <span className="md:text-sm">Settings</span>
        </Link>
      </ResponsiveDropdownItem>
      <ResponsiveDropdownItem
        className="gap-2 cursor-pointer"
        onClick={(e) => {
          // Prevent event from bubbling up to parent elements
          e.stopPropagation();
          onRequestInvite();
        }}
      >
        <span className="grid place-items-center p-1">
          <Icon name="person_add" size={18} className="text-muted-foreground" />
        </span>
        <span className="md:text-sm flex-grow justify-self-start">
          Invite members
        </span>
      </ResponsiveDropdownItem>
    </>
  );
}

CurrentTeamDropdownOptions.Skeleton = () => (
  <div className="flex flex-col gap-2 h-full overflow-y-auto">
    {Array.from({ length: 5 }).map((_, index) => (
      <div
        key={index}
        className="h-9 w-full bg-muted-foreground/10 rounded-xl"
      />
    ))}
  </div>
);

function TeamsToSwitch({ query }: { query: string }) {
  const { org: currentTeamSlug } = useParams();
  const { data: orgs } = useOrganizations();
  const availableTeamsToSwitch = orgs.filter(
    (org) => org.slug !== currentTeamSlug,
  );

  const filteredTeams = availableTeamsToSwitch.filter(
    (team) =>
      team.name.toLowerCase().includes(query.toLowerCase()) ||
      team.slug?.toLowerCase().includes(query.toLowerCase()),
  );

  if (filteredTeams.length === 0) {
    return (
      <div className="text-sm text-center py-2 text-muted-foreground">
        No teams found
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-36 overflow-y-auto">
      <div className="flex flex-col gap-2 h-36 overflow-y-auto">
        {filteredTeams.map((team) => (
          <ResponsiveDropdownItem asChild key={team.slug + team.name}>
            <Link
              to={`/${team.slug}`}
              className="w-full flex items-center gap-2 cursor-pointer"
            >
              <Avatar
                shape="square"
                url={team.avatar_url}
                fallback={team.name}
                objectFit="contain"
                size="xs"
              />
              <span className="md:text-sm">{team.name}</span>
            </Link>
          </ResponsiveDropdownItem>
        ))}
      </div>
    </div>
  );
}

TeamsToSwitch.Skeleton = () => (
  <div className="h-36 flex flex-col gap-2 overflow-y-auto">
    {Array.from({ length: 3 }).map((_, index) => (
      <Skeleton key={index} className="h-9 w-full rounded-xl" />
    ))}
  </div>
);
