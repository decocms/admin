import {
  findPinnedView,
  Integration,
  Resource,
  useConnectionViews,
  useIntegrations,
  usePinnedResources,
  useRecentResources,
  useRemoveResource,
  useRemoveView,
  useUpsertDocument,
  View,
} from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { type ReactNode, Suspense, useMemo, useState } from "react";
import { Link, useMatch, useNavigate, useParams } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../hooks/use-navigate-workspace.ts";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { TogglePin } from "../views/list.tsx";
import { SidebarFooter } from "./footer.tsx";
import { useCurrentTeam } from "./team-selector.tsx";
import { useFocusTeamAgent } from "../agents/list.tsx";
import { SearchComingSoonModal } from "../modals/search-coming-soon-modal.tsx";
import {
  CommandPalette,
  useCommandPalette,
} from "../search/command-palette.tsx";

const WithActive = ({
  children,
  ...props
}: {
  to: string;
  children: (props: { isActive: boolean }) => ReactNode;
}) => {
  const match = useMatch(props.to);

  return <div {...props}>{children({ isActive: !!match })}</div>;
};

function AddViewsDialog({
  integration,
  open,
  onOpenChange,
}: {
  integration: Integration;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currentTeam = useCurrentTeam();
  const { data: viewsData, isLoading: isLoadingViews } = useConnectionViews(
    integration,
    false,
  );
  const views = viewsData?.views || [];

  // Check which views are already added to the team
  const viewsWithStatus = useMemo(() => {
    if (!views || views.length === 0 || !currentTeam.views) return [];

    return views.map((view) => {
      const existingView = findPinnedView(currentTeam.views, integration.id, {
        name: view.name,
        url: view.url,
      });

      return {
        ...view,
        integration: integration,
        isAdded: !!existingView,
        teamViewId: existingView?.id,
      } as typeof view & {
        isAdded: boolean;
        teamViewId?: string;
        integration: Integration;
      };
    });
  }, [views, currentTeam.views, integration.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Views from {integration.name}</DialogTitle>
          <DialogDescription>
            Select views to add to your sidebar from this integration.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto">
          {isLoadingViews ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : viewsWithStatus.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {views.length === 0
                ? "No views available from this integration"
                : "All available views have already been added"}
            </div>
          ) : (
            <div className="space-y-2">
              {viewsWithStatus.map((view) => (
                <div
                  key={view.name ?? view.url ?? view.title}
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-background hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {view.icon && (
                      <Icon
                        name={view.icon}
                        size={20}
                        className="flex-shrink-0 text-muted-foreground"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium truncate">
                        {view.title}
                      </h4>
                      {view.url && (
                        <p className="text-xs text-muted-foreground truncate">
                          {view.url}
                        </p>
                      )}
                    </div>
                  </div>
                  <TogglePin view={view} />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceViews() {
  const { org, project } = useParams();
  const workspaceLink = useWorkspaceLink();
  const { isMobile, toggleSidebar } = useSidebar();
  const { data: integrations } = useIntegrations();
  const team = useCurrentTeam();
  const removeViewMutation = useRemoveView();
  const navigateWorkspace = useNavigateWorkspace();
  const navigate = useNavigate();
  const [addViewsDialogState, setAddViewsDialogState] = useState<{
    open: boolean;
    integration?: Integration;
  }>({ open: false });
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const [databaseModalOpen, setDatabaseModalOpen] = useState(false);
  const [_searchModalOpen, _setSearchModalOpen] = useState(false);
  const [_showAllRecents, _setShowAllRecents] = useState(false);

  // Recent and pinned resources
  // Use team locator if params aren't available - fallback to just undefined if no params
  const projectKey = org && project ? `${org}/${project}` : undefined;

  const { recents: _recents, removeRecent: _removeRecent } =
    useRecentResources(projectKey);
  const {
    pinnedResources: _pinnedResources,
    togglePin: _togglePin,
    isPinned: _isPinned,
  } = usePinnedResources(projectKey);

  // Command palette
  const commandPalette = useCommandPalette();

  // Hook for creating documents
  const upsertDocument = useUpsertDocument();

  const handleCreateAgent = useFocusTeamAgent();

  const handleOpenSearch = () => {
    commandPalette.setOpen(true);
  };

  const handleRemoveView = async (view: View) => {
    const isUserInView = globalThis.location.pathname.includes(
      `/views/${view.id}`,
    );
    if (isUserInView) {
      navigateWorkspace("/");
      await removeViewMutation.mutateAsync({
        viewId: view.id,
      });
      return;
    }
    await removeViewMutation.mutateAsync({
      viewId: view.id,
    });
  };

  const removeResourceMutation = useRemoveResource();

  const handleRemoveResource = async (resource: { resourceId: string }) => {
    const isUserInResource = globalThis.location.pathname.includes(
      `/rsc/${resource.resourceId}`,
    );
    if (isUserInResource) {
      navigateWorkspace("/");
      await removeResourceMutation.mutateAsync({
        resourceId: resource.resourceId,
      });
      return;
    }
    await removeResourceMutation.mutateAsync({
      resourceId: resource.resourceId,
    });
  };

  const integrationMap = new Map(
    integrations?.map((integration) => [integration.id, integration]),
  );

  const { fromIntegration, firstLevelViews, fromIntegrationResources } =
    useMemo(() => {
      const result: {
        fromIntegration: Record<string, View[]>;
        firstLevelViews: View[];
        fromIntegrationResources: Record<string, Resource[]>;
      } = {
        fromIntegration: {},
        firstLevelViews: [],
        fromIntegrationResources: {},
      };

      const views = (team?.views ?? []) as View[];
      for (const view of views) {
        const integrationId = view.integrationId as string | undefined;
        if (integrationId) {
          const isInstalled = integrations?.some(
            (integration) => integration.id === integrationId,
          );

          if (!isInstalled) {
            continue;
          }

          if (!result.fromIntegration[integrationId]) {
            result.fromIntegration[integrationId] = [];
          }
          result.fromIntegration[integrationId].push(view);
          continue;
        }

        if (view.type === "custom") {
          if (!result.fromIntegration["custom"]) {
            result.fromIntegration["custom"] = [];
          }
          result.fromIntegration["custom"].push(view);
          continue;
        }

        result.firstLevelViews.push(view);
      }
      // Process resources (stored as views with type="resource")
      const resources = team?.resources ?? [];
      for (const resource of resources) {
        const integrationId = resource.integration_id as string | undefined;
        if (integrationId) {
          const isInstalled = integrations?.some(
            (integration) => integration.id === integrationId,
          );

          if (!isInstalled) {
            continue;
          }

          if (!result.fromIntegrationResources[integrationId]) {
            result.fromIntegrationResources[integrationId] = [];
          }
          result.fromIntegrationResources[integrationId].push(resource);
        }
      }

      return result;
    }, [team?.views, team?.resources, integrations]);

  function buildViewHrefFromView(view: View): string {
    if (view.type === "custom") {
      if (view?.name) {
        return workspaceLink(`/views/${view.integrationId}/${view.name}`);
      }
      const rawUrl = view?.metadata?.url as string | undefined;
      const qs = rawUrl ? `?viewUrl=${encodeURIComponent(rawUrl)}` : "";
      return workspaceLink(`/views/${view.integrationId}/index${qs}`);
    }
    const path = view?.metadata?.path as string | undefined;
    return workspaceLink(path ?? "/");
  }

  const wellKnownItems = ["Tools", "Views", "Workflows", "Documents", "Agents"];
  const legacyTitleMap: Record<string, string> = {
    Prompts: "Documents",
  };
  const canonicalTitle = (title: string) => legacyTitleMap[title] ?? title;

  function buildResourceHrefFromResource(resource: {
    integration_id: string;
    name: string;
  }): string {
    return workspaceLink(`/rsc/${resource.integration_id}/${resource.name}`);
  }

  // Separate items for organization
  const mcpItems = firstLevelViews
    .filter((item) => wellKnownItems.includes(canonicalTitle(item.title)))
    .sort((a, b) => {
      const predefinedOrder = wellKnownItems;
      return (
        predefinedOrder.indexOf(canonicalTitle(a.title)) -
        predefinedOrder.indexOf(canonicalTitle(b.title))
      );
    });

  // Building blocks are now handled by resourceItems below

  // Resource type order for main resources section
  const resourceTypeOrder = [
    "Documents",
    "Agents",
    "Workflows",
    "Tools",
    "Views",
    "Files",
  ];
  const resourceItems = resourceTypeOrder
    .map((title) => {
      if (title === "Files") {
        return {
          title: "Files",
          icon: "folder",
          onClick: () => setFilesModalOpen(true),
          comingSoon: true,
        };
      }
      const item = mcpItems.find(
        (item) => canonicalTitle(item.title) === title,
      );
      return item ? { ...item, comingSoon: false } : null;
    })
    .filter(
      (
        item,
      ): item is
        | (View & { comingSoon: boolean })
        | {
            title: string;
            icon: string;
            onClick: () => void;
            comingSoon: boolean;
          } => item !== null,
    );

  // Filter out pinned items from recents and limit to 5 initially
  const _filteredRecents = _recents.filter((recent) => !_isPinned(recent.id));
  const _displayedRecents = _showAllRecents
    ? _filteredRecents
    : _filteredRecents.slice(0, 5);
  const _hasMoreRecents = _filteredRecents.length > 5;

  return (
    <>
      {/* SECTION 1: SEARCH + RESOURCE INSTANCES */}

      {/* Search button */}
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer justify-between"
          onClick={() => handleOpenSearch()}
        >
          <div className="flex items-center gap-2">
            <Icon
              name="search"
              size={20}
              className="text-muted-foreground/75"
            />
            <span className="truncate">Search</span>
          </div>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </SidebarMenuButton>
      </SidebarMenuItem>

      {/* Generate button */}
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => setGenerateModalOpen(true)}
        >
          <Icon name="add" size={20} className="text-muted-foreground/75" />
          <span className="truncate">Generate</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarSeparator className="my-2 -ml-1" />

      {/* SECTION 2: RESOURCES (Main Resource Types) */}
      {resourceItems.map((item) => {
        if ("onClick" in item && item.comingSoon) {
          // Files button (coming soon)
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                className="cursor-pointer"
                onClick={item.onClick}
              >
                <Icon
                  name={item.icon}
                  size={20}
                  className="text-muted-foreground/75"
                />
                <span className="truncate">{item.title}</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  Soon
                </Badge>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        }

        // Regular resource type buttons
        const view = item as View;
        const href = buildViewHrefFromView(view);
        const displayTitle = canonicalTitle(view.title);

        return (
          <SidebarMenuItem key={view.title}>
            <SidebarMenuButton asChild>
              <Link
                to={href}
                onClick={() => {
                  trackEvent("sidebar_navigation_click", {
                    item: displayTitle,
                  });
                  isMobile && toggleSidebar();
                }}
              >
                <Icon
                  name={view.icon}
                  size={20}
                  className="text-muted-foreground/75"
                />
                <span className="truncate">{displayTitle}</span>
                {view.badge && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {view.badge}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}

      <SidebarSeparator className="my-2 -ml-1" />

      {/* Manage Apps button */}
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateWorkspace("/apps");
            trackEvent("sidebar_navigation_click", {
              item: "Manage Apps",
            });
            isMobile && toggleSidebar();
          }}
        >
          <Icon
            name="grid_view"
            size={20}
            className="text-muted-foreground/75"
          />
          <span className="truncate">Manage apps</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      {/* SECTION 3: VIEWS PINNED FROM APPS */}
      {Object.entries(fromIntegration).map(([integrationId, views]) => {
        const integration = integrationMap.get(integrationId);
        const isSingleView = views.length === 1;

        if (isSingleView) {
          const [view] = views;
          const href = buildViewHrefFromView(view as View);

          return (
            <SidebarMenuItem key={integrationId}>
              <WithActive to={href}>
                {({ isActive }) => (
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="w-full pr-2!"
                  >
                    <Link
                      to={href}
                      className="group/item"
                      onClick={() => {
                        trackEvent("sidebar_navigation_click", {
                          item: view.title,
                        });
                        isMobile && toggleSidebar();
                      }}
                    >
                      <div className="relative">
                        <IntegrationAvatar
                          size="xs"
                          url={integration?.icon}
                          fallback={integration?.name}
                          className="!w-[22px] !h-[22px] !rounded-md"
                        />
                        {integration && integrationId !== "custom" && (
                          <SidebarMenuAction
                            asChild
                            className="absolute inset-0 hidden items-center justify-center rounded-md border border-border/80 bg-background/95 shadow-sm transition-opacity group-hover/item:flex"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setAddViewsDialogState({
                                open: true,
                                integration,
                              });
                            }}
                            aria-label={`Add view to ${
                              integration?.name ?? "integration"
                            }`}
                            showOnHover
                          >
                            <span
                              role="button"
                              tabIndex={0}
                              className="flex h-full w-full items-center justify-center"
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setAddViewsDialogState({
                                    open: true,
                                    integration,
                                  });
                                }
                              }}
                            >
                              <Icon
                                name="add"
                                size={14}
                                className="text-muted-foreground"
                              />
                            </span>
                          </SidebarMenuAction>
                        )}
                      </div>
                      <span className="truncate">
                        {view.title ?? integration?.name ?? "Custom"}
                      </span>
                      {view.type === "custom" && (
                        <Icon
                          name="unpin"
                          size={18}
                          className="text-muted-foreground/75 opacity-0 group-hover/item:opacity-50 hover:opacity-100 transition-opacity cursor-pointer ml-auto"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleRemoveView(view);
                          }}
                        />
                      )}
                    </Link>
                  </SidebarMenuButton>
                )}
              </WithActive>
            </SidebarMenuItem>
          );
        }

        return (
          <SidebarMenuItem key={integrationId}>
            <Collapsible
              asChild
              defaultOpen={false}
              className="group/collapsible"
            >
              <div className="group/integration-header relative">
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="w-full pr-2!">
                    <div className="relative">
                      <IntegrationAvatar
                        size="xs"
                        url={integration?.icon}
                        fallback={integration?.name}
                        className="!w-[22px] !h-[22px] !rounded-md"
                      />
                      {integration && integrationId !== "custom" && (
                        <SidebarMenuAction
                          asChild
                          className="absolute inset-0 hidden items-center justify-center rounded-md border border-border/80 bg-background/95 shadow-sm transition-opacity group-hover/integration-header:flex"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setAddViewsDialogState({
                              open: true,
                              integration,
                            });
                          }}
                          aria-label={`Add view to ${
                            integration?.name ?? "integration"
                          }`}
                          showOnHover
                        >
                          <span
                            role="button"
                            tabIndex={0}
                            className="flex h-full w-full items-center justify-center"
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                setAddViewsDialogState({
                                  open: true,
                                  integration,
                                });
                              }
                            }}
                          >
                            <Icon
                              name="add"
                              size={14}
                              className="text-muted-foreground"
                            />
                          </span>
                        </SidebarMenuAction>
                      )}
                    </div>
                    <span className="truncate">
                      {integration?.name ?? "Custom"}
                    </span>
                    <Icon
                      name="chevron_right"
                      size={18}
                      className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-muted-foreground/75"
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {views.map((view: View) => {
                      const href = buildViewHrefFromView(view as View);

                      return (
                        <SidebarMenuSubItem key={view.id}>
                          <SidebarMenuSubButton asChild>
                            <Link
                              to={href}
                              className="group/item"
                              onClick={() => {
                                trackEvent("sidebar_navigation_click", {
                                  item: view.title,
                                });
                                isMobile && toggleSidebar();
                              }}
                            >
                              <Icon
                                name={view.icon}
                                size={18}
                                className="text-muted-foreground/75"
                              />
                              <span className="truncate">{view.title}</span>
                              {view.type === "custom" && (
                                <Icon
                                  name="unpin"
                                  size={18}
                                  className="text-muted-foreground/75 opacity-0 group-hover/item:opacity-50 hover:opacity-100 transition-opacity cursor-pointer ml-auto"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleRemoveView(view);
                                  }}
                                />
                              )}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </SidebarMenuItem>
        );
      })}

      {/* Resources from integrations (existing logic) */}
      {Object.entries(fromIntegrationResources).map(
        ([integrationId, resources]) => {
          const integration = integrationMap.get(integrationId);
          const isSingleResource = resources.length === 1;

          if (isSingleResource) {
            const [resource] = resources;
            const href = buildResourceHrefFromResource(resource);

            return (
              <SidebarMenuItem key={`resource-${integrationId}`}>
                <WithActive to={href}>
                  {({ isActive }) => (
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="w-full pr-8"
                    >
                      <Link
                        to={href}
                        className="group/item"
                        onClick={() => {
                          trackEvent("sidebar_navigation_click", {
                            item: resource.title,
                          });
                          isMobile && toggleSidebar();
                        }}
                      >
                        <div className="relative">
                          <IntegrationAvatar
                            size="xs"
                            url={integration?.icon}
                            fallback={integration?.name}
                            className="!w-[18px] !h-[18px] !rounded-md"
                          />
                        </div>
                        <span className="truncate">
                          {resource.title ?? integration?.name ?? "Resource"}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive ml-auto group-hover/item:block! hidden! p-0.5 h-6"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemoveResource({ resourceId: resource.id });
                          }}
                        >
                          <Icon
                            name="remove"
                            size={18}
                            className="text-muted-foreground ml-auto group-hover/item:block! hidden!"
                          />
                        </Button>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </WithActive>
              </SidebarMenuItem>
            );
          }

          return (
            <SidebarMenuItem key={`resource-${integrationId}`}>
              <Collapsible
                asChild
                defaultOpen={false}
                className="group/collapsible"
              >
                <div className="group/integration-header relative">
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="w-full pr-8">
                      <div className="relative">
                        <IntegrationAvatar
                          size="xs"
                          url={integration?.icon}
                          fallback={integration?.name}
                          className="!w-[18px] !h-[18px] !rounded-md"
                        />
                      </div>
                      <span className="truncate">
                        {integration?.name ?? "Resources"}
                      </span>
                      <Icon
                        name="chevron_right"
                        size={18}
                        className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-muted-foreground/75"
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {resources.map((resource) => {
                        const href = buildResourceHrefFromResource(resource);

                        return (
                          <SidebarMenuSubItem key={resource.id}>
                            <SidebarMenuSubButton asChild>
                              <Link
                                to={href}
                                className="group/item"
                                onClick={() => {
                                  trackEvent("sidebar_navigation_click", {
                                    item: resource.title,
                                  });
                                  isMobile && toggleSidebar();
                                }}
                              >
                                <Icon
                                  name="folder"
                                  size={18}
                                  className="text-muted-foreground/75"
                                />
                                <span className="truncate">
                                  {resource.title}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive ml-auto group-hover/item:flex! hidden! p-0.5 h-6 w-6 items-center justify-center"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemoveResource({
                                      resourceId: resource.id,
                                    });
                                  }}
                                >
                                  <Icon
                                    name="remove"
                                    size={16}
                                    className="text-muted-foreground"
                                  />
                                </Button>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </SidebarMenuItem>
          );
        },
      )}
      {/* Pinned Resource Instances */}
      {_pinnedResources.length > 0 && (
        <>
          {_pinnedResources.map((resource) => (
            <SidebarMenuItem key={`pinned-${resource.id}`}>
              <WithActive to={resource.path}>
                {({ isActive }) => (
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="w-full pr-2"
                  >
                    <Link
                      to={resource.path}
                      className="group/item"
                      onClick={() => {
                        trackEvent("sidebar_navigation_click", {
                          item: resource.name,
                          type: "pinned-resource",
                        });
                        isMobile && toggleSidebar();
                      }}
                    >
                      {resource.type === "agent" ? (
                        <AgentAvatar
                          size="xs"
                          url={resource.icon}
                          fallback={resource.name}
                          className="!w-[20px] !h-[20px] shrink-0"
                        />
                      ) : resource.icon ? (
                        <Icon
                          name={resource.icon}
                          size={20}
                          className="text-muted-foreground/75 shrink-0"
                        />
                      ) : null}
                      <span className="truncate flex-1 min-w-0">
                        {resource.name}
                      </span>
                      <div className="ml-auto flex items-center shrink-0">
                        <Icon
                          name="unpin"
                          size={18}
                          className="text-primary opacity-0 group-hover/item:opacity-100 transition-opacity cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            _togglePin(resource);
                          }}
                        />
                      </div>
                    </Link>
                  </SidebarMenuButton>
                )}
              </WithActive>
            </SidebarMenuItem>
          ))}
        </>
      )}

      <SidebarSeparator className="my-2 -ml-1" />

      <SidebarMenuItem>
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
          Recents
        </div>
      </SidebarMenuItem>

      {/* Recent Resource Instances */}
      {_displayedRecents.length > 0 && (
        <>
          {_displayedRecents.map((resource) => (
            <SidebarMenuItem key={`recent-${resource.id}`}>
              <WithActive to={resource.path}>
                {({ isActive }) => (
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="w-full pr-2"
                  >
                    <Link
                      to={resource.path}
                      className="group/item"
                      onClick={() => {
                        trackEvent("sidebar_navigation_click", {
                          item: resource.name,
                          type: "recent-resource",
                        });
                        isMobile && toggleSidebar();
                      }}
                    >
                      {resource.type === "agent" ? (
                        <AgentAvatar
                          size="xs"
                          url={resource.icon}
                          fallback={resource.name}
                          className="!w-[20px] !h-[20px] shrink-0"
                        />
                      ) : resource.icon ? (
                        <Icon
                          name={resource.icon}
                          size={20}
                          className="text-muted-foreground/75 shrink-0"
                        />
                      ) : null}
                      <span className="truncate flex-1 min-w-0">
                        {resource.name}
                      </span>
                      <div className="ml-auto flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                        {_showAllRecents && (
                          <Icon
                            name="close"
                            size={16}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              _removeRecent(resource.id);
                            }}
                          />
                        )}
                        <Icon
                          name="push_pin"
                          size={18}
                          className="text-muted-foreground hover:text-primary cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            _togglePin({
                              id: resource.id,
                              name: resource.name,
                              type: resource.type,
                              integration_id: resource.integration_id,
                              icon: resource.icon,
                              path: resource.path,
                            });
                          }}
                        />
                      </div>
                    </Link>
                  </SidebarMenuButton>
                )}
              </WithActive>
            </SidebarMenuItem>
          ))}

          {/* Show All / Show Recent toggle */}
          {_hasMoreRecents && (
            <SidebarMenuItem>
              <SidebarMenuButton
                className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                onClick={() => _setShowAllRecents(!_showAllRecents)}
              >
                <Icon
                  name={_showAllRecents ? "expand_less" : "expand_more"}
                  size={16}
                  className="text-muted-foreground/75"
                />
                <span>{_showAllRecents ? "Show recent" : "Show all"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </>
      )}

      {/* Generate Modal */}
      <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create via AI</DialogTitle>
            <DialogDescription>Generate content with AI</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={async () => {
                setGenerateModalOpen(false);
                isMobile && toggleSidebar();
                const timestamp = new Date()
                  .toISOString()
                  .replace(/[:.]/g, "-");

                const result = await upsertDocument.mutateAsync({
                  params: {
                    name: `Untitled-${timestamp}`,
                    content: "",
                    description: "",
                  },
                });

                const documentResource = {
                  integration_id: "i:documents-management",
                  name: "document",
                };
                const href = buildResourceHrefFromResource(documentResource);
                navigate(`${href}/${encodeURIComponent(result.uri)}`);
              }}
            >
              <div className="flex items-center gap-3 text-left">
                <Icon
                  name="docs"
                  size={24}
                  className="text-muted-foreground/75 mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-semibold">Document</div>
                  <div className="text-sm text-muted-foreground">
                    Create a new document with AI assistance
                  </div>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => {
                setGenerateModalOpen(false);
              }}
            >
              <div className="flex items-center gap-3 text-left">
                <Icon
                  name="flowchart"
                  size={24}
                  className="text-muted-foreground/75 mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-semibold">Workflow</div>
                  <div className="text-sm text-muted-foreground">
                    Create a new workflow
                  </div>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => {
                setGenerateModalOpen(false);
                isMobile && toggleSidebar();

                handleCreateAgent();
              }}
            >
              <div className="flex items-center gap-3 text-left">
                <Icon
                  name="robot_2"
                  size={24}
                  className="text-muted-foreground/75 mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-semibold">Agent</div>
                  <div className="text-sm text-muted-foreground">
                    Create an AI agent with specialized capabilities
                  </div>
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search Modal */}
      <SearchComingSoonModal
        open={_searchModalOpen}
        onOpenChange={_setSearchModalOpen}
      />

      {/* Files Modal */}
      <Dialog open={filesModalOpen} onOpenChange={setFilesModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>File System Access</DialogTitle>
            <DialogDescription>Coming soon to deco.cx</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/30">
                <Icon name="folder_open" size={32} className="text-primary" />
              </div>
            </div>
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Direct file system access is coming soon. You'll be able to
                browse, edit, and manage your project files directly from the
                dashboard.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Browse project files</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Edit files in-browser</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Manage file structure</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Database Modal */}
      <Dialog open={databaseModalOpen} onOpenChange={setDatabaseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Database Management</DialogTitle>
            <DialogDescription>Coming soon to deco.cx</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/30">
                <Icon name="storage" size={32} className="text-primary" />
              </div>
            </div>
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Database management tools are coming soon. Manage your data with
                a powerful interface.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Browse tables and collections</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Run queries and scripts</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Manage data relationships</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {addViewsDialogState.integration && (
        <AddViewsDialog
          integration={addViewsDialogState.integration}
          open={addViewsDialogState.open}
          onOpenChange={(open) =>
            setAddViewsDialogState({
              open,
              integration: open ? addViewsDialogState.integration : undefined,
            })
          }
        />
      )}
      <CommandPalette
        open={commandPalette.open}
        onOpenChange={commandPalette.onOpenChange}
      />
    </>
  );
}

WorkspaceViews.Skeleton = () => (
  <div className="flex flex-col gap-0.5">
    {Array.from({ length: 20 }).map((_, index) => (
      <div key={index} className="w-full h-8">
        <Skeleton className="h-full bg-sidebar-accent rounded-md" />
      </div>
    ))}
  </div>
);

// Coming Soon menu items are now inline in the new sidebar structure

export function ProjectSidebar() {
  return (
    <Sidebar variant="sidebar">
      <SidebarContent className="flex-1 overflow-x-hidden">
        <SidebarGroup className="font-medium">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <Suspense fallback={<WorkspaceViews.Skeleton />}>
                <WorkspaceViews />
              </Suspense>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
