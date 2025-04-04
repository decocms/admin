import { useRuntime } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from "@deco/ui/components/sidebar.tsx";
import { ReactNode } from "react";
import { Link, useMatch } from "react-router";
import { AgentAvatar } from "../common/Avatar.tsx";

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
  const { state: { sidebarState, context } } = useRuntime();
  const items = sidebarState?.[context?.root ?? ""] ?? [];

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {STATIC_ITEMS.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <WithActive to={item.url}>
                    {({ isActive }) => (
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link to={item.url}>
                          <Icon name={item.icon} filled={isActive} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </WithActive>
                </SidebarMenuItem>
              ))}
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
                  {items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <WithActive to={item.href!}>
                        {({ isActive }) => (
                          <SidebarMenuButton asChild isActive={isActive}>
                            <Link to={item.href!}>
                              <div className="aspect-square w-4 h-4">
                                <AgentAvatar
                                  name={item.label}
                                  avatar={item.icon}
                                  size="sm"
                                />
                              </div>
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        )}
                      </WithActive>
                    </SidebarMenuItem>
                  ))}
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
