import { Project, useProjects } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import { Suspense, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Avatar } from "../common/avatar";
import { useFile } from "@deco/sdk";

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

  const projects = useProjects({ org: org ?? "" });
  const currentProject = useMemo(
    () => projects.find((project) => project.slug === projectParam),
    [projects, projectParam],
  );

  const { data: resolvedAvatar } = useFile(currentProject?.avatar_url ?? "");

  const [projectSearch, setProjectSearch] = useState("");

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-2 cursor-pointer hover:bg-muted-foreground/10 px-2 py-1 rounded-md">
            <Avatar
              url={resolvedAvatar ?? undefined}
              fallback={currentProject?.title ?? projectParam}
              size="xs"
              objectFit="contain"
            />
            <span>{currentProject?.title ?? projectParam}</span>
            <Icon name="expand_all" size={16} className="opacity-50" />
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="rounded-xl p-0 flex items-start w-full"
        >
          <div className="flex flex-col w-full">
            <Input
              placeholder="Search projects..."
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              className="rounded-b-none border-l-0 border-r-0 focus-visible:border-border focus-visible:ring-0 border-t-0 w-full"
            />
            {org && (
              <Suspense fallback={<SwitcherProjects.Skeleton />}>
                <SwitcherProjects org={org} search={projectSearch} />
              </Suspense>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

BreadcrumbProjectSwitcher.Skeleton = () => (
  <div className="h-4 w-16 bg-accent rounded-full animate-pulse"></div>
);
