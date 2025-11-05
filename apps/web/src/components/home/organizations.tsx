import { useOrganizations, useRecentProjects } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Suspense,
  useState,
  useDeferredValue,
  useCallback,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router";
import { ErrorBoundary } from "../../error-boundary";
import { Avatar } from "../common/avatar";
import { timeAgo } from "../../utils/time-ago";
import { CommunityCallBanner } from "../common/event/community-call-banner";
import { CreateOrganizationDialog } from "../sidebar/create-team-dialog";
import { TopbarLayout } from "../layout/home";
import { OrgAvatars, OrgMemberCount } from "./members";
import { ProjectCard } from "./projects";
import { normalizeGithubImportValue } from "../../utils/github-import.ts";

function OrganizationCard({
  name,
  slug,
  url,
  avatarUrl,
  teamId,
  badge,
}: {
  name: string;
  slug: string;
  url: string;
  avatarUrl: string;
  teamId: number;
  badge?: ReactNode;
}) {
  return (
    <Card className="group transition-colors flex flex-col">
      <Link to={url} className="flex flex-col">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <Avatar
              url={avatarUrl}
              fallback={slug}
              size="lg"
              objectFit="contain"
            />
            {badge ? (
              <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                {badge}
                <Icon
                  name="chevron_right"
                  size={20}
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
            ) : (
              <Icon
                name="chevron_right"
                size={20}
                className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              />
            )}
          </div>
          <div className="flex flex-col gap-[2px]">
            <h3 className="text-sm text-muted-foreground truncate">/{slug}</h3>
            <p className="font-medium truncate">{name}</p>
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-between items-center">
          <ErrorBoundary fallback={<div className="w-full h-8"></div>}>
            <OrgAvatars teamId={teamId} />
            <OrgMemberCount teamId={teamId} />
          </ErrorBoundary>
        </div>
      </Link>
    </Card>
  );
}

function Organizations({
  query,
  importGithubSlug,
}: {
  query?: string;
  importGithubSlug?: string;
}) {
  const teams = useOrganizations({ searchQuery: query });

  if (teams.data?.length === 0) {
    return <Organizations.Empty />;
  }

  return (
    <div className="w-full grid grid-cols-2 @min-3xl:grid-cols-3 @min-6xl:grid-cols-4 gap-4">
      {teams.data?.map((team) => (
        <OrganizationCard
          key={team.id}
          name={team.name}
          slug={team.slug}
          url={
            importGithubSlug
              ? `/${team.slug}?importGithub=${encodeURIComponent(importGithubSlug)}`
              : `/${team.slug}`
          }
          avatarUrl={team.avatar_url || ""}
          teamId={team.id}
          badge={
            importGithubSlug ? (
              <span className="text-[10px] font-medium uppercase tracking-wide text-foreground/80">
                Import here
              </span>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}

Organizations.Skeleton = () => (
  <div className="grid grid-cols-2 @min-3xl:grid-cols-3 @min-6xl:grid-cols-4 gap-4">
    {Array.from({ length: 8 }).map((_, index) => (
      <div
        key={index}
        className="bg-card hover:bg-accent transition-colors flex flex-col rounded-lg animate-pulse"
      >
        <div className="p-4 flex flex-col gap-4">
          <div className="h-12 w-12 bg-card/75 rounded-lg"></div>
          <div className="h-4 w-32 bg-card/75 rounded-lg"></div>
          <div className="h-4 w-32 bg-card/75 rounded-lg"></div>
        </div>
        <div className="p-4 border-t border-border flex items-center">
          <div className="h-6 w-6 bg-card/75 rounded-full animate-pulse"></div>
          <div className="h-6 w-6 bg-card/75 rounded-full animate-pulse -ml-2"></div>
          <div className="h-6 w-6 bg-card/75 rounded-full animate-pulse -ml-2"></div>
        </div>
      </div>
    ))}
  </div>
);

Organizations.Error = () => (
  <div className="flex flex-col items-center justify-center mt-64 gap-4 p-8">
    <Icon name="error" size={24} className="text-muted-foreground" />
    <div className="text-sm text-muted-foreground text-center">
      We couldn't load your projects right now.
      <br />
      Please try again later.
    </div>
  </div>
);

Organizations.Empty = () => (
  <div className="flex flex-col items-center justify-center mt-64 gap-4 p-8 w-full">
    <div className="text-sm text-muted-foreground text-center">
      No projects found.
    </div>
  </div>
);

function RecentProjectsSection() {
  const recent = useRecentProjects();

  if (recent?.length === 0) {
    return null;
  }

  return (
    <div className="@container flex flex-col gap-4 mb-10">
      <h2 className="text-xl font-medium">Recent projects</h2>
      <div className="grid grid-cols-2 @min-3xl:grid-cols-3 @min-6xl:grid-cols-4 gap-4">
        {recent.map((project) => (
          <ProjectCard
            key={`${project.org.slug}/${project.slug}`}
            project={project}
            url={`/${project.org.slug}/${project.slug}`}
            slugPrefix="/"
            showMembers={false}
            hideSlug
            additionalInfo={
              project.last_accessed_at
                ? `Last seen ${timeAgo(project.last_accessed_at)}`
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

RecentProjectsSection.Skeleton = () => (
  <div className="@container flex flex-col gap-4">
    <div className="h-6 w-40 bg-card rounded animate-pulse" />
    <div className="grid grid-cols-2 @min-3xl:grid-cols-3 @min-6xl:grid-cols-4 gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="bg-card flex flex-col rounded-lg">
          <div className="p-4 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="h-12 w-12 bg-card rounded-lg animate-pulse" />
              <div className="h-5 w-5 bg-card rounded animate-pulse" />
            </div>
            <div className="h-4 w-40 bg-card rounded animate-pulse" />
            <div className="h-4 w-48 bg-card rounded animate-pulse" />
            <div className="h-3 w-32 bg-card rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

function MyOrganizations() {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const importGithubParam = searchParams.get("importGithub") ?? undefined;
  const { slug: importGithubSlug, url: importGithubUrl } =
    normalizeGithubImportValue(importGithubParam);

  const handleClearImport = useCallback(() => {
    if (!importGithubSlug) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("importGithub");
    setSearchParams(next, { replace: true });
  }, [importGithubSlug, searchParams, setSearchParams]);

  return (
    <div className="min-h-full w-full bg-background">
      <div className="p-8 flex flex-col gap-4 w-full max-w-7xl mx-auto min-h-[calc(100vh-48px)]">
        {importGithubSlug ? (
          <div className="rounded-lg border border-border bg-card px-6 py-5 flex flex-col gap-3">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Icon name="code" size={18} className="text-foreground" />
              <span className="uppercase tracking-wide text-[11px] font-semibold">
                Deploy from GitHub
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">
                  Select an organization to import
                </h2>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {importGithubSlug}
                  </span>
                  {importGithubUrl ? (
                    <span className="text-xs text-muted-foreground block">
                      {importGithubUrl}
                    </span>
                  ) : null}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearImport}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : (
          <>
            <CommunityCallBanner />
            <ErrorBoundary fallback={null}>
              <Suspense fallback={<RecentProjectsSection.Skeleton />}>
                <RecentProjectsSection />
              </Suspense>
            </ErrorBoundary>
          </>
        )}
        <div className="flex items-center justify-between mt-4">
          <h2 className="text-xl font-medium">My organizations</h2>
          <div className="flex items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button
              variant="default"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Icon name="add" size={16} />
              <span>New organization</span>
            </Button>
          </div>
        </div>
        <div className="@container overflow-y-auto flex-1 pb-28">
          <ErrorBoundary fallback={<Organizations.Error />}>
            <Suspense fallback={<Organizations.Skeleton />}>
              <Organizations
                query={deferredQuery}
                importGithubSlug={importGithubSlug}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>

      <CreateOrganizationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}

export function OrgList() {
  return (
    <TopbarLayout breadcrumb={[]}>
      <MyOrganizations />
    </TopbarLayout>
  );
}
