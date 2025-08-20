import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useNavigate } from "react-router";
import { useUserTeams } from "../sidebar/team-selector.tsx";
import { Avatar } from "../common/avatar/index.tsx";
import { Suspense, useEffect, useState, useMemo } from "react";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { SDKProvider, useProfile } from "@deco/sdk";
import { SplitScreenLayout } from "../login/layout.tsx";

function WorkspaceList() {
  const navigate = useNavigate();
  const teams = useUserTeams();
  const { data: profile } = useProfile();

  // Get user's first name from profile, same as main-chat.tsx
  const userName = useMemo(() => {
    const fullName = profile?.metadata?.full_name || "User";
    return fullName.split(" ")[0];
  }, [profile?.metadata?.full_name]);

  const handleWorkspaceSelect = (teamSlug: string) => {
    // Navigate to chat for the selected workspace
    navigate(`/${teamSlug}/chat`);
  };

  // For demo purposes, show empty personal workspaces but keep org workspaces
  const personalWorkspaces: any[] = [];
  // Put all actual workspaces in team workspaces for now
  const teamWorkspaces = teams;

  const handleCreateWorkspace = () => {
    // TODO: Implement workspace creation
    console.log("Create workspace clicked");
  };

  const WorkspaceItem = ({ workspace }: { workspace: any }) => (
    <button
      onClick={() => handleWorkspaceSelect(workspace.slug)}
      className="w-full flex items-center justify-between pl-6 pr-3 py-4 rounded-full border border-border hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Avatar
          url={workspace.avatarUrl}
          fallback={workspace.label}
          size="sm"
          shape="square"
        />
        <span className="text-sm font-medium text-foreground">
          {workspace.label}
        </span>
      </div>
      <Icon name="arrow_forward" className="text-muted-foreground" size={18} />
    </button>
  );

  return (
    <div className="flex flex-col gap-16 items-start justify-center px-4 py-[140px] h-full w-full max-w-[500px] mx-auto">
      {/* Welcome Section */}
      <div className="flex flex-col gap-8 w-full">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-foreground">
            Welcome, {userName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Join or create a workspace
          </p>
        </div>

        {/* Personal Workspaces - Create Workspace Card */}
        <div className="w-full">
          <div className="bg-input rounded-2xl p-px">
            <div 
              onClick={handleCreateWorkspace}
              className="bg-muted rounded-2xl p-6 cursor-pointer hover:bg-muted/80 transition-colors"
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 bg-muted-foreground/10 rounded-full flex items-center justify-center">
                  <Icon name="plus" size={24} className="text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-medium text-foreground">
                    Create workspace
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Create your first workspace to get started
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Workspaces Section - Only show if there are team workspaces */}
      {teamWorkspaces.length > 0 && (
        <div className="flex flex-col gap-6 w-full">
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold text-foreground">
              Join your team
            </h3>
            <p className="text-sm text-muted-foreground">
              You have access to the shared workspaces below
            </p>
          </div>

          {/* Single Organization Card */}
          <div className="w-full">
            <div className="bg-input rounded-2xl p-px">
              {/* Organization Header */}
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-sm text-foreground">
                  Workspaces from @deco.cx
                </span>
                <span className="text-sm text-foreground/15">
                  {teamWorkspaces.length}
                </span>
              </div>
              {/* Workspaces List */}
              <div className="bg-dc-50 rounded-b-2xl p-4">
                <div className="flex flex-col gap-3 max-h-[280px] overflow-y-auto">
                  {teamWorkspaces.map((workspace) => (
                    <WorkspaceItem key={workspace.slug || workspace.id} workspace={workspace} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceListSkeleton() {
  return (
    <div className="flex flex-col gap-16 items-start justify-center px-4 py-[140px] h-full w-full max-w-[500px] mx-auto">
      <div className="flex flex-col gap-8 w-full">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="bg-dc-200 rounded-2xl p-px">
          <div className="bg-dc-50 rounded-2xl p-4">
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between pl-6 pr-3 py-4 rounded-full border border-border">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                  <Skeleton className="w-4 h-4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceSelectionContent() {
  return (
    <SplitScreenLayout>
      <Suspense fallback={<WorkspaceListSkeleton />}>
        <WorkspaceList />
      </Suspense>
    </SplitScreenLayout>
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