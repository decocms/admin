import {
  Locator,
  SDKProvider,
  useOrganizations,
  useRecentProjects,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { EntityCard } from "@deco/ui/components/entity-card.tsx";
import { EntityGrid } from "@deco/ui/components/entity-grid.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Suspense,
  useState,
  useDeferredValue,
  useCallback,
  type ReactNode,
} from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ErrorBoundary } from "../../error-boundary";
import { timeAgo } from "../../utils/time-ago";
import { CommunityCallBanner } from "../common/event/community-call-banner";
import { CreateOrganizationDialog } from "../sidebar/create-team-dialog";
import { TopbarLayout } from "../layout/home";
import { OrgAvatars, OrgMemberCount } from "./members";
import { ProjectCard } from "./projects";
import { normalizeGithubImportValue } from "../../utils/github-import.ts";
import { useCopy } from "../../hooks/use-copy.ts";

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
  const navigate = useNavigate();
  const isSelectionMode = Boolean(badge);

  return (
    <EntityCard
      onNavigate={() => navigate(url)}
      showHoverRing={isSelectionMode}
    >
      <EntityCard.Header>
        <EntityCard.AvatarSection>
          <EntityCard.Avatar
            url={avatarUrl}
            fallback={slug}
            size="lg"
            objectFit="contain"
          />
          {badge ? (
            <EntityCard.Badge>
              {badge}
              <div className="w-0 overflow-hidden group-hover:w-5 transition-all">
                <Icon
                  name="chevron_right"
                  size={20}
                  className="text-muted-foreground"
                />
              </div>
            </EntityCard.Badge>
          ) : (
            <Icon
              name="chevron_right"
              size={20}
              className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            />
          )}
        </EntityCard.AvatarSection>
        <EntityCard.Content>
          <EntityCard.Subtitle>/{slug}</EntityCard.Subtitle>
          <EntityCard.Title>{name}</EntityCard.Title>
        </EntityCard.Content>
      </EntityCard.Header>
      <EntityCard.Footer>
        <ErrorBoundary fallback={<div className="w-full h-8"></div>}>
          <OrgAvatars teamId={teamId} />
          <OrgMemberCount teamId={teamId} />
        </ErrorBoundary>
      </EntityCard.Footer>
    </EntityCard>
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
    <EntityGrid columns={{ sm: 2, md: 3, lg: 4 }}>
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
    </EntityGrid>
  );
}

Organizations.Skeleton = () => (
  <EntityGrid.Skeleton count={8} columns={{ sm: 2, md: 3, lg: 4 }} />
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
          <SDKProvider
            key={`${project.org.slug}/${project.slug}`}
            locator={Locator.from({
              org: project.org.slug,
              project: project.slug,
            })}
          >
            <ProjectCard
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
          </SDKProvider>
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
  const { handleCopy, copied } = useCopy();

  const handleClearImport = useCallback(() => {
    if (!importGithubSlug) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("importGithub");
    setSearchParams(next, { replace: true });
  }, [importGithubSlug, searchParams, setSearchParams]);

  const handleCopyGithubUrl = useCallback(() => {
    const fullUrl = importGithubUrl || `https://github.com/${importGithubSlug}`;
    handleCopy(fullUrl);
  }, [importGithubUrl, importGithubSlug, handleCopy]);

  return (
    <div className="min-h-full w-full bg-background">
      <div className="p-8 flex flex-col gap-4 w-full max-w-7xl mx-auto min-h-[calc(100vh-48px)]">
        {importGithubSlug ? (
          <div className="rounded-xl border border-border bg-background p-4 flex items-center gap-2 shadow-xs sticky top-16 z-10">
            <div className="shrink-0 size-[60px] flex items-center justify-center">
              <img
                src="/img/github.svg"
                alt="GitHub"
                className="size-[60px] brightness-50"
              />
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <p className="text-base font-medium leading-6">
                Select an organization to import
              </p>
              <div
                className="border border-border rounded-lg flex items-center shrink-0 w-fit cursor-pointer hover:bg-accent transition-colors"
                onClick={handleCopyGithubUrl}
              >
                {copied ? (
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <Icon name="check" size={16} className="text-success" />
                    <p className="text-sm text-foreground whitespace-nowrap">
                      Copied
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="border-r border-border px-2 py-1.5">
                      <p className="text-sm text-muted-foreground whitespace-nowrap">
                        https://github.com/
                      </p>
                    </div>
                    <div className="px-4 py-1.5">
                      <p className="text-sm text-foreground whitespace-nowrap">
                        {importGithubSlug}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearImport}
              className="shrink-0 h-8 rounded-xl"
            >
              Dismiss
            </Button>
          </div>
        ) : (
          <>
            <CommunityCallBanner />
          </>
        )}
        <Suspense
          fallback={
            importGithubSlug ? (
              <MyOrganizations.ListSkeleton />
            ) : (
              <MyOrganizations.Skeleton />
            )
          }
        >
          {!importGithubSlug && <RecentProjectsSection />}
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
          <div className="@container overflow-y-auto flex-1 pb-28 p-1 -m-1">
            <ErrorBoundary fallback={<Organizations.Error />}>
              <Organizations
                query={deferredQuery}
                importGithubSlug={importGithubSlug}
              />
            </ErrorBoundary>
          </div>
        </Suspense>
      </div>

      <CreateOrganizationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}

MyOrganizations.Skeleton = function MyOrganizationsSkeleton() {
  return (
    <>
      <RecentProjectsSection.Skeleton />
      <div className="flex items-center justify-between mt-4">
        <div className="h-6 w-40 bg-card rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-56 bg-card rounded animate-pulse" />
          <div className="h-9 w-40 bg-card rounded animate-pulse" />
        </div>
      </div>
      <div className="@container overflow-y-auto flex-1 pb-28 p-1 -m-1">
        <Organizations.Skeleton />
      </div>
    </>
  );
};

MyOrganizations.ListSkeleton = function MyOrganizationsListSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between mt-4">
        <div className="h-6 w-40 bg-card rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-56 bg-card rounded animate-pulse" />
          <div className="h-9 w-40 bg-card rounded animate-pulse" />
        </div>
      </div>
      <div className="@container overflow-y-auto flex-1 pb-28 p-1 -m-1">
        <Organizations.Skeleton />
      </div>
    </>
  );
};

export function OrgList() {
  return (
    <TopbarLayout breadcrumb={[]}>
      <MyOrganizations />
    </TopbarLayout>
  );
}
