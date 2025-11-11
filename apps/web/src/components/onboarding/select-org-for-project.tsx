import { Suspense, useState, useDeferredValue, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useOrganizations, useCreateProject } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ErrorBoundary } from "../../error-boundary";
import { Avatar } from "../common/avatar";
import { TopbarLayout } from "../layout/home";
import { OrgAvatars, OrgMemberCount } from "../home/members";

function OrganizationCard({
  name,
  slug,
  avatarUrl,
  teamId,
  onSelect,
}: {
  name: string;
  slug: string;
  avatarUrl: string;
  teamId: number;
  onSelect: (slug: string) => void;
}) {
  return (
    <Card className="group transition-all flex flex-col hover:ring-2 hover:ring-primary">
      <button
        type="button"
        onClick={() => onSelect(slug)}
        className="flex flex-col text-left"
      >
        <div className="p-4 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <Avatar
              url={avatarUrl}
              fallback={slug}
              size="lg"
              objectFit="contain"
            />
            <div className="flex items-center text-xs text-muted-foreground">
              <span className="text-[10px] font-medium uppercase tracking-wide text-foreground/80">
                Create here
              </span>
              <div className="w-0 overflow-hidden group-hover:w-5 transition-all">
                <Icon
                  name="chevron_right"
                  size={20}
                  className="text-muted-foreground"
                />
              </div>
            </div>
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
      </button>
    </Card>
  );
}

function Organizations({
  query,
  onSelectOrg,
}: {
  query?: string;
  onSelectOrg: (slug: string) => void;
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
          avatarUrl={team.avatar_url || ""}
          teamId={team.id}
          onSelect={onSelectOrg}
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
      We couldn't load your organizations right now.
      <br />
      Please try again later.
    </div>
  </div>
);

Organizations.Empty = () => (
  <div className="flex flex-col items-center justify-center mt-64 gap-4 p-8 w-full">
    <div className="text-sm text-muted-foreground text-center">
      No organizations found. Please create one first.
    </div>
  </div>
);

function SelectOrgContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [isCreating, setIsCreating] = useState(false);

  const initialInput = searchParams.get("initialInput") || "";
  const autoSend = searchParams.get("autoSend") === "true";

  const handleSelectOrg = useCallback(
    async (orgSlug: string) => {
      setIsCreating(true);
      try {
        // Create project with default name
        const projectName = "New Project";
        const baseSlug = projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        // Create project with retry logic for slug collisions
        let project;
        let attempt = 0;
        const maxAttempts = 10;

        while (attempt < maxAttempts) {
          try {
            const slugToTry =
              attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
            project = await createProject.mutateAsync({
              org: orgSlug,
              slug: slugToTry,
              title: projectName,
            });
            break; // Success, exit loop
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            // Check if it's a slug collision error
            if (
              errorMsg.toLowerCase().includes("slug") &&
              (errorMsg.toLowerCase().includes("exists") ||
                errorMsg.toLowerCase().includes("already") ||
                errorMsg.toLowerCase().includes("taken") ||
                errorMsg.toLowerCase().includes("duplicate"))
            ) {
              attempt++;
              if (attempt >= maxAttempts) {
                throw new Error(
                  "Failed to create project: all slug attempts failed",
                );
              }
              // Try next attempt
              continue;
            }
            // Not a slug error, throw it
            throw err;
          }
        }

        if (!project) {
          throw new Error("Failed to create project");
        }

        // Navigate to project with initialInput params
        const params = new URLSearchParams();
        if (initialInput) {
          params.set("initialInput", initialInput);
        }
        if (autoSend) {
          params.set("autoSend", "true");
        }

        navigate(`/${orgSlug}/${project.slug}?${params.toString()}`);
      } catch (error) {
        console.error("Failed to create project:", error);
        if (error instanceof Error) {
          alert(`Failed to create project: ${error.message}`);
        }
      } finally {
        setIsCreating(false);
      }
    },
    [initialInput, autoSend, createProject, navigate],
  );

  const handleDismiss = useCallback(() => {
    navigate("/");
  }, [navigate]);

  return (
    <div className="min-h-full w-full bg-background">
      <div className="p-8 flex flex-col gap-4 w-full max-w-7xl mx-auto min-h-[calc(100vh-48px)]">
        <div className="rounded-xl border border-border bg-background p-4 flex items-center gap-2 shadow-xs sticky top-16 z-10">
          <div className="shrink-0 size-[60px] flex items-center justify-center">
            <Icon name="add_circle" size={60} className="text-primary" />
          </div>
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <p className="text-base font-medium leading-6">
              Select an organization to create project
            </p>
            {initialInput && (
              <div className="border border-border rounded-lg flex items-center shrink-0 w-fit">
                <div className="border-r border-border px-2 py-1.5">
                  <p className="text-sm text-muted-foreground whitespace-nowrap">
                    Initial prompt:
                  </p>
                </div>
                <div className="px-4 py-1.5">
                  <p className="text-sm text-foreground whitespace-nowrap max-w-md truncate">
                    {initialInput}
                  </p>
                </div>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            className="shrink-0 h-8 rounded-xl"
            disabled={isCreating}
          >
            Dismiss
          </Button>
        </div>

        <div className="flex items-center justify-between mt-4">
          <h2 className="text-xl font-medium">My organizations</h2>
          <div className="flex items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isCreating}
            />
          </div>
        </div>

        <div className="@container overflow-y-auto flex-1 pb-28 p-1 -m-1">
          <ErrorBoundary fallback={<Organizations.Error />}>
            <Suspense fallback={<Organizations.Skeleton />}>
              <Organizations
                query={deferredQuery}
                onSelectOrg={handleSelectOrg}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export function SelectOrgForProject() {
  return (
    <TopbarLayout breadcrumb={[]}>
      <SelectOrgContent />
    </TopbarLayout>
  );
}

export default SelectOrgForProject;
