import React, { useState } from "react";
import { Link, useLocation } from "react-router";
import { cn } from "@deco/ui/lib/utils.ts";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { trackEvent } from "../../hooks/analytics.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { SidebarFooter } from "./footer.tsx";
import { Header as SidebarHeader } from "./header.tsx";

// Component for navigation items with active state
function NavItem({
  to,
  icon,
  label,
  isActive,
  onClick,
}: {
  to: string;
  icon: string;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <Link to={to} onClick={onClick}>
          <Icon name={icon} size={16} className="text-muted-foreground" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// Component for sub-navigation items (indented)
function SubNavItem({
  to,
  icon,
  label,
  onClick,
}: {
  to: string;
  icon: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label} className="pl-6">
        <Link to={to} onClick={onClick}>
          <Icon name={icon} size={16} className="text-muted-foreground" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const workspaceLink = useWorkspaceLink();
  const location = useLocation();
  const [appsExpanded, setAppsExpanded] = useState(false);
  const { state } = useSidebar();
  
  // Get current path to determine active state
  const isActive = (path: string) => {
    return location.pathname.includes(path);
  };

  return (
    <Sidebar 
      collapsible="icon" 
      className="p-2 h-full bg-transparent [&_[data-sidebar=sidebar]]:bg-transparent [&_[data-slot=sidebar-inner]]:bg-transparent"
      style={{ "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}
    >
      <div className="bg-secondary rounded-2xl h-full flex flex-col group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-16">
        <SidebarHeader />
        
        <SidebarContent className="px-2 py-2 group-data-[collapsible=icon]:px-1">
          {/* Main Navigation */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                <NavItem
                  to={workspaceLink("/chat")}
                  icon="message_circle"
                  label="Chat"
                  isActive={isActive("/chat")}
                  onClick={() => trackEvent("sidebar_navigation_click", { item: "Chat" })}
                />
                <NavItem
                  to={workspaceLink("/discover")}
                  icon="compass"
                  label="Discover"
                  isActive={isActive("/discover")}
                  onClick={() => trackEvent("sidebar_navigation_click", { item: "Discover" })}
                />
                <NavItem
                  to={workspaceLink("/bounties")}
                  icon="briefcase-business"
                  label="Bounties"
                  isActive={isActive("/bounties")}
                  onClick={() => trackEvent("sidebar_navigation_click", { item: "Bounties" })}
                />
                <NavItem
                  to={workspaceLink("/monitor")}
                  icon="line_chart"
                  label="Monitor"
                  isActive={isActive("/monitor")}
                  onClick={() => trackEvent("sidebar_navigation_click", { item: "Monitor" })}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* MCPs Section */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="MCPs">
                    <Icon name="layout_grid" size={16} className="text-muted-foreground" />
                    <span>MCPs</span>
                    {state === "expanded" && (
                      <Icon
                        name="plus"
                        size={16}
                        className="text-muted-foreground opacity-50 hover:opacity-100 transition-opacity ml-auto"
                      />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                {state === "expanded" && (
                  <>
                    <SubNavItem
                      to={workspaceLink("/agents")}
                      icon="bot"
                      label="Agents"
                      onClick={() => trackEvent("sidebar_navigation_click", { item: "Agents" })}
                    />
                    <SubNavItem
                      to={workspaceLink("/prompts")}
                      icon="notebook"
                      label="Prompts"
                      onClick={() => trackEvent("sidebar_navigation_click", { item: "Prompts" })}
                    />
                    <SubNavItem
                      to={workspaceLink("/connections")}
                      icon="wrench"
                      label="Tools"
                      onClick={() => trackEvent("sidebar_navigation_click", { item: "Tools" })}
                    />
                    <SubNavItem
                      to={workspaceLink("/views")}
                      icon="app_window"
                      label="Views"
                      onClick={() => trackEvent("sidebar_navigation_click", { item: "Views" })}
                    />
                    <SubNavItem
                      to={workspaceLink("/workflows")}
                      icon="workflow"
                      label="Workflows"
                      onClick={() => trackEvent("sidebar_navigation_click", { item: "Workflows" })}
                    />
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* APPS Section */}
          <SidebarGroup>
            <SidebarGroupLabel>APPS</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                {/* deco.cx expandable item */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setAppsExpanded(!appsExpanded)}
                    tooltip="deco.cx"
                  >
                    <div className="w-4 h-4 bg-[#d0ec1a] rounded flex items-center justify-center">
                      <Icon
                        name="check"
                        size={10}
                        className="text-[#07401a]"
                      />
                    </div>
                    <span>deco.cx</span>
                    {state === "expanded" && (
                      <Icon
                        name="chevron_down"
                        size={16}
                        className={cn(
                          "text-muted-foreground opacity-50 transition-transform ml-auto",
                          appsExpanded && "rotate-180"
                        )}
                      />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                {/* Expanded items as sub-nav items - only show when sidebar is expanded */}
                {appsExpanded && state === "expanded" && (
                  <>
                    <SubNavItem
                      to={workspaceLink("/pages")}
                      icon="layers"
                      label="Pages"
                      onClick={() => trackEvent("sidebar_navigation_click", { item: "Pages" })}
                    />
                    <SubNavItem
                      to={workspaceLink("/sections")}
                      icon="layout_panel_top"
                      label="Sections"
                      onClick={() => trackEvent("sidebar_navigation_click", { item: "Sections" })}
                    />
                    <SubNavItem
                      to={workspaceLink("/loaders")}
                      icon="box"
                      label="Loaders"
                      onClick={() => trackEvent("sidebar_navigation_click", { item: "Loaders" })}
                    />
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        
        <SidebarFooter />
      </div>
    </Sidebar>
  );
}