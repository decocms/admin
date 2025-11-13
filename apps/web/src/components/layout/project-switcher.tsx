import { Project, useProjects, useFile } from "@deco/sdk";
import { TopbarSwitcher } from "@deco/ui/components/topbar-switcher.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Suspense, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Avatar } from "@deco/ui/components/avatar.tsx";

function SwitcherProjectItem({
  project,
  org,
}: {
  project: Project;
  org: string;
}) {
  const navigate = useNavigate();
  const { data: resolvedAvatar } = useFile(project.avatar_url ?? "");

  return (
    <Button
      key={project.id}
      variant="ghost"
      size="sm"
      className="w-full justify-start font-normal"
      onClick={() => navigate(`/${org}/${project.slug}`)}
    >
      <Avatar
        url={resolvedAvatar ?? undefined}
        fallback={project.slug}
        size="xs"
        objectFit="contain"
      />
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">
        {project.title}
      </span>
    </Button>
  );
}

export function SwitcherProjects({
  org,
  search,
}: {
  org: string;
  search: string;
}) {
  const projects = useProjects({ searchQuery: search, org });

  return (
    <div className="flex flex-col gap-0.5 p-1 max-h-44 overflow-y-auto">
      {projects.length === 0 && (
        <div className="text-muted-foreground text-sm px-1 py-8 text-center">
          No projects found.
        </div>
      )}
      {projects.map((project) => (
        <SwitcherProjectItem key={project.id} org={org} project={project} />
      ))}
    </div>
  );
}

SwitcherProjects.Skeleton = () => (
  <div className="flex flex-col w-full gap-0.5 p-1 max-h-44 overflow-y-auto">
    <div className="h-8 w-full bg-accent rounded-lg animate-pulse"></div>
    <div className="h-8 w-full bg-accent rounded-lg animate-pulse"></div>
  </div>
);

export function BreadcrumbProjectSwitcher() {
  const { org, project: projectParam } = useParams();
  const navigate = useNavigate();

  const projects = useProjects({ org: org ?? "" });
  const currentProject = useMemo(
    () => projects.find((project) => project.slug === projectParam),
    [projects, projectParam],
  );

  const { data: resolvedAvatar } = useFile(currentProject?.avatar_url ?? "");

  const [projectSearch, setProjectSearch] = useState("");

  // Map SDK project shape to TopbarSwitcher entity shape
  const mappedProjects = useMemo(
    () =>
      projects.map((p) => ({
        slug: p.slug,
        name: p.title,
        avatarUrl: p.avatar_url,
      })),
    [projects],
  );

  const mappedCurrentProject = currentProject
    ? {
        slug: currentProject.slug,
        name: currentProject.title,
        avatarUrl: resolvedAvatar ?? currentProject.avatar_url,
      }
    : undefined;

  return (
    <TopbarSwitcher>
      <TopbarSwitcher.Trigger
        onClick={() => navigate(`/${org}/${projectParam}`)}
      >
        <Link
          to={`/${org}/${projectParam}`}
          className="flex items-center gap-2"
        >
          <TopbarSwitcher.CurrentItem
            item={mappedCurrentProject}
            fallback={projectParam}
          />
        </Link>
      </TopbarSwitcher.Trigger>

      <TopbarSwitcher.Content>
        <TopbarSwitcher.Panel>
          <TopbarSwitcher.Search
            placeholder="Search projects..."
            value={projectSearch}
            onChange={setProjectSearch}
          />

          {org && (
            <Suspense fallback={<SwitcherProjects.Skeleton />}>
              <SwitcherProjects org={org} search={projectSearch} />
            </Suspense>
          )}
        </TopbarSwitcher.Panel>
      </TopbarSwitcher.Content>
    </TopbarSwitcher>
  );
}

BreadcrumbProjectSwitcher.Skeleton = TopbarSwitcher.Skeleton;
