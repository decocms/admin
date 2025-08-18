import { useTeam, useTeams } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownSeparator,
  ResponsiveDropdownTrigger,
} from "@deco/ui/components/responsive-dropdown.tsx";
import { Suspense, useState } from "react";
import { Link, useParams } from "react-router";
import { useUser } from "../../hooks/use-user.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { Avatar } from "../common/avatar/index.tsx";
import { CreateTeamDialog } from "./create-team-dialog.tsx";
import { InviteTeamMembersDialog } from "../common/invite-team-members-dialog.tsx";
import { type Theme, type View, withDefaultViews } from "@deco/sdk";
import { useDocumentMetadata } from "../../hooks/use-document-metadata.ts";
import { trackEvent } from "../../hooks/analytics.ts";

export interface CurrentTeam {
  avatarUrl: string | undefined;
  slug: string;
  id: number | string;
  label: string;
  theme: Theme | undefined;
}

function useUserTeam(): CurrentTeam & { views: View[] } {
  const user = useUser();
  const avatarUrl = user?.metadata?.avatar_url ?? undefined;
  const name = user?.metadata?.full_name || user?.email;
  const label = `${name.split(" ")[0]}'s team`;
  return {
    avatarUrl,
    label,
    id: user?.id ?? "",
    slug: "",
    theme: undefined,
    views: withDefaultViews([]),
  };
}

export function useCurrentTeam(): CurrentTeam & { views: View[] } {
  const { teamSlug } = useParams();
  const userTeam = useUserTeam();
  const { data: teamData } = useTeam(teamSlug);
  if (!teamSlug) {
    return userTeam;
  }
  return {
    avatarUrl: teamData?.avatar_url,
    label: teamData?.name || teamSlug || "",
    id: teamData?.id ?? "",
    slug: teamData?.slug ?? teamSlug ?? "",
    theme: teamData?.theme,
    views: withDefaultViews(teamData?.views ?? []),
  };
}

export function useUserTeams() {
  const { data: teams } = useTeams();
  const personalTeam = useUserTeam();
  const { slug: currentSlug } = useCurrentTeam();

  const allTeams: CurrentTeam[] = [
    personalTeam,
    ...teams.map((team) => ({
      avatarUrl: team.avatar_url,
      slug: team.slug,
      label: team.name,
      id: team.id,
      theme: team.theme,
    })),
  ];

  const teamsWithoutCurrentTeam = allTeams.filter(
    (team) => team.slug !== currentSlug,
  );

  return teamsWithoutCurrentTeam;
}

function CurrentTeamDropdownTrigger() {
  const { avatarUrl, label } = useCurrentTeam();

  return (
    <ResponsiveDropdownTrigger asChild>
      <button className="flex items-center gap-1.5">
        <Avatar
          shape="square"
          url={avatarUrl}
          fallback={label}
          objectFit="contain"
          size="xs"
          className="rounded-[7.25px]"
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-foreground">{label}</span>
        </div>
      </button>
    </ResponsiveDropdownTrigger>
  );
}

CurrentTeamDropdownTrigger.Skeleton = () => (
  <div className="flex items-center gap-1.5">
    <Skeleton className="w-[29px] h-[29px] rounded-[7.25px]" />
    <Skeleton className="h-4 w-24" />
  </div>
);

function CurrentTeamDropdownOptions({
  onRequestInvite,
}: {
  onRequestInvite: () => void;
}) {
  const workspaceLink = useWorkspaceLink();
  const { teamSlug } = useParams();

  return (
    <>
      {teamSlug && (
        <>
          <ResponsiveDropdownItem asChild>
            <Link to={workspaceLink("/settings/team")}>
              <Icon name="settings" size={16} />
              Team Settings
            </Link>
          </ResponsiveDropdownItem>
          <ResponsiveDropdownItem onClick={onRequestInvite}>
            <Icon name="person_add" size={16} />
            Invite Members
          </ResponsiveDropdownItem>
          <ResponsiveDropdownSeparator />
        </>
      )}
      <ResponsiveDropdownItem asChild>
        <Link to={workspaceLink("/settings")}>
          <Icon name="settings" size={16} />
          Settings
        </Link>
      </ResponsiveDropdownItem>
    </>
  );
}

CurrentTeamDropdownOptions.Skeleton = () => (
  <div className="flex flex-col gap-1 p-2">
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-8 w-full" />
  </div>
);

function SwitchTeam({
  onRequestCreateTeam,
}: {
  onRequestCreateTeam: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const teams = useUserTeams();
  const workspaceLink = useWorkspaceLink();

  const filteredTeams = teams.filter((team) =>
    team.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <>
      <div className="px-2 pb-2">
        <Input
          placeholder="Search teams..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8"
        />
      </div>
      {filteredTeams.map((team) => (
        <ResponsiveDropdownItem key={team.id} asChild>
          <Link
            to={team.slug ? `/shared/${team.slug}/chat` : "/chat"}
            onClick={() => {
              trackEvent("team_switch", {
                from_team: useCurrentTeam().slug || "personal",
                to_team: team.slug || "personal",
              });
            }}
          >
            <Avatar
              shape="square"
              url={team.avatarUrl}
              fallback={team.label}
              objectFit="contain"
              size="xs"
            />
            {team.label}
          </Link>
        </ResponsiveDropdownItem>
      ))}
      <ResponsiveDropdownSeparator />
      <ResponsiveDropdownItem onClick={onRequestCreateTeam}>
        <Icon name="add" size={16} />
        Create Team
      </ResponsiveDropdownItem>
    </>
  );
}

export function TeamSelector() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const { id: teamId, label, avatarUrl } = useCurrentTeam();

  useDocumentMetadata({
    title: label ? `${label} | deco.chat` : undefined,
    favicon: avatarUrl,
  });

  return (
    <>
      <ResponsiveDropdown>
        <Suspense fallback={<CurrentTeamDropdownTrigger.Skeleton />}>
          <CurrentTeamDropdownTrigger />
        </Suspense>
        <ResponsiveDropdownContent align="start" className="md:w-[240px]">
          <Suspense fallback={<CurrentTeamDropdownOptions.Skeleton />}>
            <CurrentTeamDropdownOptions
              onRequestInvite={() => setIsInviteDialogOpen(true)}
            />
          </Suspense>
          <ResponsiveDropdownSeparator />
          <SwitchTeam onRequestCreateTeam={() => setIsCreateDialogOpen(true)} />
        </ResponsiveDropdownContent>
      </ResponsiveDropdown>
      <CreateTeamDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
      <InviteTeamMembersDialog
        teamId={typeof teamId === "number" ? teamId : undefined}
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
      />
    </>
  );
}