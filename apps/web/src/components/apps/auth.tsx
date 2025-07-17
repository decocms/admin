import { type Integration, SDKProvider, type Team, useIntegrations, useTeams } from "@deco/sdk";
import { Suspense, useState } from "react";
import { useSearchParams } from "react-router";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Avatar } from "../common/avatar/index.tsx";
import { BaseRouteLayout } from "../layout";
import { type CurrentTeam, useUserTeams } from "../sidebar/team-selector.tsx";
import { useUser } from "../../hooks/use-user.ts";

const OAuthSearchParamsSchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string(),
  next: z.string().optional(),
  workspace_hint: z.string().optional(),
});

const preSelectTeam = (teams: CurrentTeam[], workspace_hint: string | undefined) => {
  if (teams.length === 1) {
    return teams[0];
  }

  if (!workspace_hint) {
    return null;
  }

  return teams.find((team) => team.slug === workspace_hint) ?? null;
};

const useAppIntegrations = (appName: string) => {
  const { data: allIntegrations } = useIntegrations();
  return allIntegrations?.filter((integration) => {
    if (integration.id.startsWith("i:")) {
      console.log(integration);
    }
    if ("appName" in integration) {
      return integration.appName === appName;
    }
    return false;
  });
}

const preSelectIntegration = (integrations: Integration[]) => {
  if (integrations.length === 1) {
    return integrations[0];
  }
  return null;
}

function ShowInstalls({ appName }: { team: CurrentTeam, appName: string }) {
  const matchingIntegrations = useAppIntegrations(appName);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(preSelectIntegration(matchingIntegrations));

  if (!selectedIntegration) {
    return <div>No integrations found</div>;
  }

  if (selectedIntegration) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <Avatar
          url={selectedIntegration.icon}
          fallback={selectedIntegration.name}
          size="lg"
          shape="square"
        />
        <h1 className="text-2xl font-bold">{selectedIntegration.name}</h1>
        <p className="text-muted-foreground">{selectedIntegration.description}</p>
      </div>
    );
  }
}

function AppsOAuth(
  { client_id, redirect_uri, next, workspace_hint }: z.infer<
    typeof OAuthSearchParamsSchema
  >,
) {
  const teams = useUserTeams();
  const user = useUser();
  const [team, setTeam] = useState<CurrentTeam | null>(
    preSelectTeam(teams, workspace_hint),
  );
  const [showTeamSelector, setShowTeamSelector] = useState(false);

  if (!teams || teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">No teams available</h1>
          <p className="text-muted-foreground">
            You need to be part of a team to install this app.
          </p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-center space-y-6">
          <h1 className="text-2xl font-bold">Select a team</h1>
          <p className="text-muted-foreground">
            Choose which team to install this app into
          </p>

          <div className="w-full max-w-sm">
            <Select
              value=""
              onValueChange={(value) =>
                setTeam(teams.find((team) => team.slug === value) ?? null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.slug} value={team.slug}>
                    <div className="flex items-center gap-3">
                      <Avatar
                        url={team.avatarUrl}
                        fallback={team.label}
                        size="sm"
                        shape="square"
                        objectFit="contain"
                      />
                      <span>{team.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-2xl font-bold">Install app to team</h1>
        <p className="text-muted-foreground">
          This app will be installed into the selected team
        </p>

        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center gap-4 p-4 border rounded-xl bg-card">
            <Avatar
              url={team.avatarUrl}
              fallback={team.label}
              size="lg"
              shape="square"
            />
            <div className="text-left">
              <h3 className="font-semibold">{team.label}</h3>
              <p className="text-sm text-muted-foreground">Team</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTeamSelector(!showTeamSelector)}
            className="gap-2"
          >
            <Icon name="edit" size={16} />
            Change team
          </Button>
        </div>

        {showTeamSelector && (
          <div className="w-full max-w-sm space-y-3">
            <p className="text-sm text-muted-foreground">
              Select a different team:
            </p>
            <Select
              value={team?.slug}
              onValueChange={(value) => {
                setTeam(teams.find((team) => team.slug === value) ?? null);
                setShowTeamSelector(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((teamOption) => (
                  <SelectItem key={teamOption.slug} value={teamOption.slug}>
                    <div className="flex items-center gap-3">
                      <Avatar
                        url={teamOption.avatarUrl}
                        fallback={teamOption.label}
                        size="sm"
                        shape="square"
                      />
                      <span>{teamOption.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <SDKProvider workspace={team.id === user.id ? `users/${user.id}` : `shared/${team.slug}`}>
          <ShowInstalls team={team} appName={client_id} />
        </SDKProvider>

        <div className="pt-4">
          <Button className="w-full">
            Continue with {team.label}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AppsAuthLayout() {
  const [searchParams] = useSearchParams();
  const result = OAuthSearchParamsSchema.safeParse(
    Object.fromEntries(searchParams),
  );

  if (!result.success) {
    return <div>Invalid search params</div>;
  }

  return (
    <BaseRouteLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <AppsOAuth {...result.data} />
      </Suspense>
    </BaseRouteLayout>
  );
}
