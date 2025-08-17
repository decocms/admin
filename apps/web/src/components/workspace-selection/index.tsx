import { Card, CardContent, CardHeader, CardTitle } from "@deco/ui/components/card.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useNavigate } from "react-router";
import { useUserTeams } from "../sidebar/team-selector.tsx";
import { Avatar } from "../common/avatar/index.tsx";
import { Suspense } from "react";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { SDKProvider } from "@deco/sdk";

function WorkspaceList() {
  const navigate = useNavigate();
  const teams = useUserTeams();

  const handleWorkspaceSelect = (teamSlug: string) => {
    // Navigate to onboarding for the selected workspace
    navigate(`/${teamSlug}/onboarding`);
  };

  // Separate personal and team workspaces
  const personalWorkspaces = teams.filter(team => !team.slug); // Personal workspace has no slug
  const teamWorkspaces = teams.filter(team => team.slug); // Team workspaces have slugs

  // Add some mock personal/team workspaces for testing scrolling
  const mockPersonalWorkspaces = [
    {
      id: 'personal-1',
      slug: '',
      label: 'My Personal Space',
      avatarUrl: undefined,
    },
    {
      id: 'team-1',
      slug: 'my-side-project',
      label: 'My Side Project',
      avatarUrl: undefined,
    },
    {
      id: 'team-2',
      slug: 'freelance-work',
      label: 'Freelance Work',
      avatarUrl: undefined,
    },
    {
      id: 'team-3',
      slug: 'hobby-projects',
      label: 'Hobby Projects',
      avatarUrl: undefined,
    }
  ];

  // Combine real teams with mock data for demo
  const allPersonalWorkspaces = [...personalWorkspaces, ...mockPersonalWorkspaces.filter(w => !w.slug)];
  const allTeamWorkspaces = [...teamWorkspaces, ...mockPersonalWorkspaces.filter(w => w.slug)];

  // Mock organization workspaces for demo (more items to test scrolling)
  const mockOrgWorkspaces = [
    {
      id: 'org-1',
      slug: 'acme-corp',
      label: 'Acme Corp',
      avatarUrl: undefined,
      memberCount: 12,
    },
    {
      id: 'org-2', 
      slug: 'tech-startup',
      label: 'Tech Startup',
      avatarUrl: undefined,
      memberCount: 8,
    },
    {
      id: 'org-3',
      slug: 'design-agency',
      label: 'Design Agency',
      avatarUrl: undefined,
      memberCount: 15,
    },
    {
      id: 'org-4',
      slug: 'marketing-team',
      label: 'Marketing Team',
      avatarUrl: undefined,
      memberCount: 6,
    },
    {
      id: 'org-5',
      slug: 'dev-collective',
      label: 'Dev Collective',
      avatarUrl: undefined,
      memberCount: 22,
    },
    {
      id: 'org-6',
      slug: 'consulting-firm',
      label: 'Consulting Firm',
      avatarUrl: undefined,
      memberCount: 18,
    }
  ];

  if (teams.length === 0 && allPersonalWorkspaces.length === 0 && allTeamWorkspaces.length === 0) {
    return (
      <div className="text-center space-y-4">
        <p className="text-muted-foreground">
          No workspaces available. Create your first team to get started.
        </p>
        <Button onClick={() => navigate("/onboarding")}>
          Get Started
        </Button>
      </div>
    );
  }

  const WorkspaceCard = ({ workspace, isPersonal = false, isOrg = false }: { workspace: any, isPersonal?: boolean, isOrg?: boolean }) => (
    <Card 
      key={workspace.slug || workspace.id} 
      className="cursor-pointer hover:bg-muted/50 transition-colors h-full"
      onClick={() => handleWorkspaceSelect(workspace.slug)}
    >
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Avatar
            shape="square"
            url={workspace.avatarUrl}
            fallback={workspace.label}
            objectFit="contain"
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{workspace.label}</h3>
            <p className="text-sm text-muted-foreground truncate">
              {isPersonal 
                ? 'Personal workspace' 
                : isOrg && workspace.memberCount
                  ? `@${workspace.slug} • ${workspace.memberCount} members`
                  : `@${workspace.slug}`
              }
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      {/* Personal Workspaces */}
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Icon name="person" className="text-muted-foreground" size={20} />
          <div>
            <h2 className="text-lg font-semibold">Personal</h2>
            <p className="text-sm text-muted-foreground">Your personal workspaces</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4 max-h-96">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {allPersonalWorkspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} isPersonal />
            ))}
            {allTeamWorkspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} />
            ))}
            {/* Fill empty slots if needed */}
            {(allPersonalWorkspaces.length + allTeamWorkspaces.length) === 0 && (
              <Card className="border-dashed border-2 border-muted-foreground/25">
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">No personal workspaces</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Organization Workspaces */}
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Icon name="business" className="text-muted-foreground" size={20} />
          <div>
            <h2 className="text-lg font-semibold">Organizations</h2>
            <p className="text-sm text-muted-foreground">Shared team workspaces</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4 max-h-96">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mockOrgWorkspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} isOrg />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceListSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      {/* Personal Workspaces Skeleton */}
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Skeleton className="h-5 w-5 rounded" />
          <div>
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-40 mt-1" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4 max-h-96">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Organization Workspaces Skeleton */}
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Skeleton className="h-5 w-5 rounded" />
          <div>
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-36 mt-1" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4 max-h-96">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceSelectionContent() {
  return (
    <div className="h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-6xl h-[80vh] flex flex-col">
        <CardHeader className="text-center pb-6 px-8 pt-8">
          <CardTitle className="text-2xl">Select Workspace</CardTitle>
          <p className="text-muted-foreground">
            Choose a workspace to continue
          </p>
        </CardHeader>
        <CardContent className="flex-1 px-8 pb-8 overflow-hidden">
          <Suspense fallback={<WorkspaceListSkeleton />}>
            <WorkspaceList />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

export function WorkspaceSelectionLayout() {
  // Use a dummy workspace for global operations like listing teams
  // The actual workspace will be selected by the user
  return (
    <SDKProvider workspace="users/temp">
      <WorkspaceSelectionContent />
    </SDKProvider>
  );
}
