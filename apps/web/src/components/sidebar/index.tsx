import { useIntegrations, useRemoveView, View } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { type ReactNode, Suspense, useMemo } from "react";
import { Link, useMatch } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../hooks/use-navigate-workspace.ts";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
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

function WorkspaceViews() {
  const workspaceLink = useWorkspaceLink();
  const { isMobile, toggleSidebar } = useSidebar();
  const { data: integrations } = useIntegrations();
  const team = useCurrentTeam();
  const removeViewMutation = useRemoveView();
  const navigateWorkspace = useNavigateWorkspace();

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

  const integrationMap = new Map(
    integrations?.map((integration) => [integration.id, integration]),
  );

  const { fromIntegration, firstLevelViews } = useMemo(() => {
    const result: {
      fromIntegration: Record<string, View[]>;
      firstLevelViews: View[];
    } = {
      fromIntegration: {},
      firstLevelViews: [],
    };

    const views = (team?.views ?? []) as View[];
    for (const view of views) {
      const integrationId = view.integrationId as string | undefined;
      if (integrationId) {
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

    return result;
  }, [team?.views]);

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

  // Separate items for organization
  const mcpItems = firstLevelViews
    .filter((item) =>
      ["Agents", "Apps", "Prompts", "Views", "Workflows", "Triggers"].includes(
        item.title,
      ),
    )
    .sort((a, b) => a.title.localeCompare(b.title));
  const otherItems = firstLevelViews.filter((item) =>
    ["Monitor"].includes(item.title),
  );

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateWorkspace("/discover");
          }}
        >
          <Icon
            name="storefront"
            size={20}
            className="text-muted-foreground/75"
          />
          <span className="truncate">Discover</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {mcpItems.map((item) => {
        const displayTitle = item.title;
        const href = buildViewHrefFromView(item as View);

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
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
      {/* Regular items */}
      {otherItems.map((item) => {
        const href = buildViewHrefFromView(item as View);

        return (
          <SidebarMenuItem key={item.title}>
            <WithActive to={href}>
              {({ isActive }) => (
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.title}
                >
                  <Link
                    to={href}
                    className="group/item"
                    onClick={() => {
                      trackEvent("sidebar_navigation_click", {
                        item: item.title,
                      });
                      isMobile && toggleSidebar();
                    }}
                  >
                    <Icon
                      name={item.icon}
                      filled={isActive}
                      size={20}
                      className="text-muted-foreground/75"
                    />
                    <span className="truncate">{item.title}</span>

                    {item.type === "custom" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive ml-auto group-hover/item:block! hidden! p-0.5 h-6"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveView(item);
                        }}
                      >
                        <Icon
                          name="remove"
                          size={20}
                          className="text-muted-foreground ml-auto group-hover/item:block! hidden!"
                        />
                      </Button>
                    )}
                  </Link>
                </SidebarMenuButton>
              )}
            </WithActive>
          </SidebarMenuItem>
        );
      })}
      {Object.entries(fromIntegration).map(([integrationId, views]) => {
        const integration = integrationMap.get(integrationId);

        return (
          <SidebarMenuItem key={integrationId}>
            <Collapsible asChild defaultOpen className="group/collapsible">
              <div>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="w-full">
                    <IntegrationAvatar
                      size="xs"
                      url={integration?.icon}
                      fallback={integration?.name}
                      className="!w-[22px] !h-[22px] !rounded-md"
                    />
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
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
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
