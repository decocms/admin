import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { ReactNode } from "react";
import { Link, useMatch } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useBasePath } from "../../hooks/useBasePath.ts";

export const SETTINGS_ITEMS = [
  {
    url: "/settings",
    title: "General",
    icon: "settings",
  },
  {
    url: "/settings/members",
    title: "Members",
    icon: "group",
  },
  {
    url: "/settings/billing",
    title: "Billing",
    icon: "payments",
  },
  {
    url: "/settings/usage",
    title: "Usage",
    icon: "monitoring",
  },
  {
    url: "/settings/audit",
    title: "Audit",
    icon: "fact_check",
  },
] as const;

export type SettingsPage =
  | (typeof SETTINGS_ITEMS)[number]["title"]
  | "general"
  | "members"
  | "billing"
  | "usage"
  | "audit";

const WithActive = (
  { children, ...props }: {
    to: string;
    children: (props: { isActive: boolean }) => ReactNode;
  },
) => {
  const match = useMatch(props.to);
  const isActive = !!match;

  return (
    <div {...props}>
      {children({ isActive })}
    </div>
  );
};

export function SettingsSidebar() {
  const withBasePath = useBasePath();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleSettingsItemClick = (title: string) => {
    trackEvent("settings_navigation_click", {
      item: title,
    });
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="md:h-14 h-12 py-2 flex flex-row items-center bg-accent/30 px-4 md:px-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex flex-row items-center justify-between">
            <div className="hidden md:block">
              <SidebarMenuButton asChild>
                <Link
                  to={withBasePath("/")}
                  className="flex items-center gap-2"
                >
                  <Icon name="arrow_back" size={16} />
                  <span>Back</span>
                </Link>
              </SidebarMenuButton>
            </div>

            <div className="md:hidden w-full flex justify-between items-center gap-2">
              <div className="flex-1">
                <SidebarMenuButton asChild>
                  <Link
                    to={withBasePath("/")}
                    className="flex items-center gap-2"
                  >
                    <Icon name="arrow_back" size={16} />
                    <span>Back</span>
                  </Link>
                </SidebarMenuButton>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="w-8 h-8"
              >
                <Icon name="menu" weight={300} size={20} />
              </Button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="flex flex-col h-full overflow-x-hidden">
        <div className="flex flex-col h-full">
          <div className="flex-none">
            <SidebarMenu className="gap-0.5 mt-1 px-2">
              {SETTINGS_ITEMS.map((item) => {
                const href = withBasePath(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <WithActive to={href}>
                      {({ isActive }) => (
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={isCollapsed ? item.title : undefined}
                          className="h-9"
                        >
                          <Link
                            to={href}
                            onClick={() => {
                              handleSettingsItemClick(item.title);
                              // On mobile, automatically close the sidebar after navigation
                              if (globalThis.innerWidth < 768) {
                                toggleSidebar();
                              }
                            }}
                          >
                            <Icon name={item.icon} filled={isActive} />
                            <span className="truncate">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      )}
                    </WithActive>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
