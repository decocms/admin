// deno-lint-ignore-file ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
import { useOrganizations, useProjects } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Suspense, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Avatar } from "../common/avatar";
import { CreateOrganizationDialog } from "../sidebar/create-team-dialog";

function SwitcherOrgProjects({ org, search }: { org: string; search: string }) {
  const projects = useProjects({ searchQuery: search, org });
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-0.5 p-1 max-h-44 overflow-y-auto">
      {projects.length === 0 && (
        <div className="text-muted-foreground text-sm px-1 py-8 text-center">
          No projects found.
        </div>
      )}
      {projects.map((project) => (
        <Button
          key={project.id}
          variant="ghost"
          size="sm"
          className="w-full justify-start font-normal"
          onClick={() => navigate(`/${org}/${project.slug}`)}
        >
          <Avatar
            url={project.avatar_url ?? undefined}
            fallback={project.slug}
            size="xs"
            objectFit="contain"
          />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {project.title}
          </span>
        </Button>
      ))}
    </div>
  );
}

SwitcherOrgProjects.Skeleton = () => (
  <div className="flex flex-col w-full gap-0.5 p-1 max-h-44 overflow-y-auto">
    <div className="h-8 w-full bg-stone-100 rounded-lg animate-pulse"></div>
    <div className="h-8 w-full bg-stone-100 rounded-lg animate-pulse"></div>
  </div>
);

export function BreadcrumbOrgSwitcher() {
  const { org } = useParams();
  const organizations = useOrganizations();
  const navigate = useNavigate();
  const currentOrg = useMemo(
    () => organizations.data?.find((organization) => organization.slug === org),
    [organizations.data, org],
  );

  const [orgSearch, setOrgSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [hoveredOrg, setHoveredOrg] = useState<string | null>(
    currentOrg?.slug ?? null,
  );
  const [creatingOrganization, setCreatingOrganization] = useState(false);

  const filteredOrganizations = useMemo(() => {
    if (!organizations.data) return [];
    const filtered = organizations.data.filter((organization) =>
      organization.name.toLowerCase().includes(orgSearch.toLowerCase()),
    );
    // Move currentOrg (by slug) to the front if present
    if (org) {
      const idx = filtered.findIndex((o) => o.slug === org);
      if (idx > 0) {
        const [current] = filtered.splice(idx, 1);
        filtered.unshift(current);
      }
    }
    return filtered;
  }, [organizations.data, orgSearch, org]);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-2 cursor-pointer hover:bg-muted-foreground/10 px-2 py-1 rounded-md">
            <Avatar
              url={currentOrg?.avatar_url}
              fallback={currentOrg?.name ?? org}
              size="xs"
              objectFit="contain"
            />
            <span>{currentOrg?.name ?? org}</span>
            <Icon name="expand_all" size={16} className="opacity-50" />
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="rounded-xl p-0 flex items-start w-[480px]"
        >
          <div className="flex flex-col w-[240px] border-r border-border">
            <Input
              placeholder="Search organizations..."
              value={orgSearch}
              onChange={(e) => setOrgSearch(e.target.value)}
              className="rounded-b-none rounded-r-none border-t-0 border-x-0 focus-visible:border-border focus-visible:ring-0"
            />
            <div className="flex flex-col gap-0.5 p-1 max-h-44 overflow-y-auto">
              {filteredOrganizations.length === 0 && (
                <div className="text-muted-foreground text-sm px-1 py-8 text-center">
                  No organizations found.
                </div>
              )}
              {filteredOrganizations?.map((organization) => (
                <Button
                  key={organization.slug}
                  onMouseEnter={() => setHoveredOrg(organization.slug)}
                  onClick={() => navigate(`/${organization.slug}`)}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start font-normal"
                >
                  <Avatar
                    url={organization.avatar_url}
                    fallback={organization.name}
                    size="xs"
                    className="!w-[22px] !h-[22px]"
                    objectFit="contain"
                  />
                  <span>{organization.name}</span>
                </Button>
              ))}
            </div>
            <div className="px-1 pb-1 pt-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal text-muted-foreground"
                onClick={() => setCreatingOrganization(true)}
              >
                + Create organization
              </Button>
            </div>
            <Separator />
            <div className="px-1 pb-1 pt-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal"
                onClick={() => navigate(`/${org}/settings`)}
              >
                <Icon name="settings" size={16} />
                <span>Settings</span>
              </Button>
            </div>
          </div>
          <div className="flex flex-col w-[240px]">
            <Input
              placeholder="Search projects..."
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              className="rounded-b-none rounded-l-none border-l-0 focus-visible:border-border focus-visible:ring-0 border-t-0"
            />
            {hoveredOrg && (
              <Suspense fallback={<SwitcherOrgProjects.Skeleton />}>
                <SwitcherOrgProjects org={hoveredOrg} search={projectSearch} />
              </Suspense>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <CreateOrganizationDialog
        open={creatingOrganization}
        onOpenChange={setCreatingOrganization}
      />
    </>
  );
}

BreadcrumbOrgSwitcher.Skeleton = () => (
  <div className="h-4 w-16 bg-stone-100 rounded-full animate-pulse"></div>
);
