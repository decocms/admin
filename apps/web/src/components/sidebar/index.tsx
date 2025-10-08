import {
  findPinnedView,
  Integration,
  Resource,
  useConnectionViews,
  useCreatePrompt,
  useIntegrations,
  useRemoveResource,
  useRemoveView,
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
import { Link, useMatch } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../hooks/use-navigate-workspace.ts";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { TogglePin } from "../views/list.tsx";
import { SidebarFooter } from "./footer.tsx";
import { useCurrentTeam } from "./team-selector.tsx";

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
  const workspaceLink = useWorkspaceLink();
  const { isMobile, toggleSidebar } = useSidebar();
  const { data: integrations } = useIntegrations();
  const team = useCurrentTeam();
  const removeViewMutation = useRemoveView();
  const navigateWorkspace = useNavigateWorkspace();
  const [addViewsDialogState, setAddViewsDialogState] = useState<{
    open: boolean;
    integration?: Integration;
  }>({ open: false });
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const [databaseModalOpen, setDatabaseModalOpen] = useState(false);

  // Hook for creating documents
  const createPrompt = useCreatePrompt();

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

  // Building blocks
  const toolsItem = mcpItems.find(
    (item) => canonicalTitle(item.title) === "Tools",
  );
  const viewsItem = mcpItems.find(
    (item) => canonicalTitle(item.title) === "Views",
  );
  // Core abstractions (Documents, Workflows, Agents) - main menu items
  const coreAbstractionTitles = ["Documents", "Workflows", "Agents"];
  const coreItems = coreAbstractionTitles
    .map((title) =>
      mcpItems.find((item) => canonicalTitle(item.title) === title),
    )
    .filter((item): item is View => item !== undefined);

  return (
    <>
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
                            aria-label={`Add view to ${integration?.name ?? "integration"}`}
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
            <Collapsible asChild defaultOpen className="group/collapsible">
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
                          aria-label={`Add view to ${integration?.name ?? "integration"}`}
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

      {/* Apps with Store + button */}
      <SidebarMenuItem>
        <div className="group/item relative">
          <SidebarMenuButton
            className="cursor-pointer w-full pr-10"
            onClick={() => {
              navigateWorkspace("/apps");
            }}
          >
            <Icon
              name="grid_view"
              size={20}
              className="text-muted-foreground/75"
            />
            <span className="truncate">Apps</span>
          </SidebarMenuButton>
          <SidebarMenuAction
            asChild
            className="absolute right-1.5 inset-y-0 flex items-center"
            showOnHover={false}
          ></SidebarMenuAction>
        </div>
      </SidebarMenuItem>

      {/* Core abstractions: Documents, Workflows, Agents */}
      {coreItems.map((item) => {
        const displayTitle = canonicalTitle(item.title);
        const href = buildViewHrefFromView(item as View);
        const view = item as View;

        return (
          <SidebarMenuItem key={item.title}>
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
                  name={item.icon}
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

      {/* Developer accordion */}
      <SidebarMenuItem>
        <Collapsible asChild defaultOpen className="group/collapsible">
          <div>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton className="w-full">
                <Icon
                  name="settings"
                  size={20}
                  className="text-muted-foreground/75"
                />
                <span className="truncate">Developer</span>
                <Icon
                  name="chevron_right"
                  size={18}
                  className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-muted-foreground/75"
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {/* Tools */}
                {toolsItem && (
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild>
                      <Link
                        to={buildViewHrefFromView(toolsItem as View)}
                        onClick={() => {
                          trackEvent("sidebar_navigation_click", {
                            item: "Tools",
                          });
                          isMobile && toggleSidebar();
                        }}
                      >
                        <Icon
                          name={toolsItem.icon}
                          size={18}
                          className="text-muted-foreground/75"
                        />
                        <span className="truncate">Tools</span>
                        {(toolsItem as View).badge && (
                          <Badge
                            variant="secondary"
                            className="ml-auto text-xs"
                          >
                            {(toolsItem as View).badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )}

                {/* Views */}
                {viewsItem && (
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild>
                      <Link
                        to={buildViewHrefFromView(viewsItem as View)}
                        onClick={() => {
                          trackEvent("sidebar_navigation_click", {
                            item: "Views",
                          });
                          isMobile && toggleSidebar();
                        }}
                      >
                        <Icon
                          name={viewsItem.icon}
                          size={18}
                          className="text-muted-foreground/75"
                        />
                        <span className="truncate">Views</span>
                        {(viewsItem as View).badge && (
                          <Badge
                            variant="secondary"
                            className="ml-auto text-xs"
                          >
                            {(viewsItem as View).badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )}

                {/* Files */}
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    className="cursor-pointer"
                    onClick={() => setFilesModalOpen(true)}
                  >
                    <Icon
                      name="folder"
                      size={18}
                      className="text-muted-foreground/75"
                    />
                    <span className="truncate">Files</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Soon
                    </Badge>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>

                {/* Link */}
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    className="cursor-pointer"
                    onClick={() => setLinkModalOpen(true)}
                  >
                    <Icon
                      name="link"
                      size={18}
                      className="text-muted-foreground/75"
                    />
                    <span className="truncate">Link</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Soon
                    </Badge>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </SidebarMenuItem>

      {/* Resources section */}
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
              <Collapsible asChild defaultOpen className="group/collapsible">
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
                                  className="text-destructive hover:text-destructive ml-auto group-hover/item:block! hidden! p-0.5 h-6"
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
                                    size={18}
                                    className="text-muted-foreground ml-auto group-hover/item:block! hidden!"
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

      {/* Generate Modal */}
      <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate New</DialogTitle>
            <DialogDescription>
              Choose what you want to create
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={async () => {
                setGenerateModalOpen(false);
                isMobile && toggleSidebar();

                // Create a new empty prompt and navigate to it
                const result = await createPrompt.mutateAsync({
                  name: "",
                  content: "",
                });
                navigateWorkspace(`/documents/${result.id}`);
              }}
            >
              <div className="flex items-start gap-3 text-left">
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
                isMobile && toggleSidebar();

                // Navigate to workflows with query params to trigger Decopilot
                const message = encodeURIComponent(
                  "Please help me create a new workflow",
                );
                navigateWorkspace(
                  `/workflows?initialInput=${message}&autoSend=true&openDecopilot=true`,
                );
              }}
            >
              <div className="flex items-start gap-3 text-left">
                <Icon
                  name="flowchart"
                  size={24}
                  className="text-muted-foreground/75 mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-semibold">Workflow</div>
                  <div className="text-sm text-muted-foreground">
                    Build an automated workflow
                  </div>
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Modal */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Local Development</DialogTitle>
            <DialogDescription>Coming soon to decocms.com</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/30">
                <Icon name="terminal" size={32} className="text-primary" />
              </div>
            </div>
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Soon you'll be able to clone and work on your projects locally
                using:
              </p>
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm border">
                <code className="text-foreground">
                  git clone admin.decocms.com/my-team/my-project
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                Work locally with your favorite editor and sync changes
                seamlessly
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                A powerful database management interface is coming soon. You'll
                be able to manage your data, run queries, and view schemas
                directly from the dashboard.
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

export function ProjectSidebar() {
  return (
    <Sidebar variant="sidebar">
      <SidebarContent className="flex flex-col h-full overflow-x-hidden">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-none">
            <SidebarGroup className="font-medium">
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  <Suspense fallback={<WorkspaceViews.Skeleton />}>
                    <WorkspaceViews />
                  </Suspense>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        </div>
        <SidebarFooter />
      </SidebarContent>
    </Sidebar>
  );
}
