import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@deco/ui/components/sidebar.tsx";
import { ReactNode } from "react";
import { Link, useMatch } from "react-router";
import { useBasePath } from "../../hooks/useBasePath.ts";
import { useGlobalState } from "../../stores/global.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import { SidebarFooter } from "./footer.tsx";
import { Header as SidebarHeader } from "./header.tsx";

const STATIC_ITEMS = [
  {
    url: "/",
    title: "Chat",
    icon: "forum",
  },
  {
    url: "/integrations",
    title: "Integrations",
    icon: "conversion_path",
  },
  {
    url: "/agents",
    title: "Agents",
    icon: "groups",
  },
];

const WithActive = (
  { children, ...props }: {
    to: string;
    children: (props: { isActive: boolean }) => ReactNode;
  },
) => {
  const match = useMatch(props.to);

  return (
    <div {...props}>
      {children({ isActive: !!match })}
    </div>
  );
};

export function AppSidebar() {
  const { state: { sidebarState, context } } = useGlobalState();
  const items = sidebarState?.[context?.slug ?? ""] ?? [];
  const withBasePath = useBasePath();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {STATIC_ITEMS.map((item) => {
                const href = withBasePath(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <WithActive to={href}>
                      {({ isActive }) => (
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                        >
                          <Link to={href}>
                            <Icon name={item.icon} filled={isActive} />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      )}
                    </WithActive>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {items.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Agents</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const href = withBasePath(item.href);

                    return (
                      <SidebarMenuItem key={item.href}>
                        <WithActive to={href}>
                          {({ isActive }) => (
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              tooltip={item.label}
                            >
                              <Link to={href}>
                                <div className="aspect-square w-4 h-4">
                                  <AgentAvatar
                                    name={item.label}
                                    avatar={item.icon}
                                    className="rounded"
                                  />
                                </div>
                                <span>{item.label}</span>
                              </Link>
                            </SidebarMenuButton>
                          )}
                        </WithActive>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter />
    </Sidebar>
  );
}
