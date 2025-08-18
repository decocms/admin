import { useState } from "react";
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
      <Link
        to={to}
        onClick={onClick}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2.5 rounded-lg hover:bg-foreground/5 transition-colors w-full",
          isActive && "bg-foreground/10"
        )}
      >
        <Icon
          name={icon}
          size={16}
          className="text-muted-foreground opacity-50"
        />
        <span className="text-sm text-foreground">{label}</span>
      </Link>
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
      <Link
        to={to}
        onClick={onClick}
        className="flex items-center gap-1.5 pl-8 pr-4 py-2.5 rounded-lg w-full hover:bg-foreground/5 transition-colors"
      >
        <Icon
          name={icon}
          size={16}
          className="text-muted-foreground opacity-50"
        />
        <span className="text-sm text-foreground">{label}</span>
      </Link>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const workspaceLink = useWorkspaceLink();
  const location = useLocation();
  const [appsExpanded, setAppsExpanded] = useState(false);
  
  // Get current path to determine active state
  const isActive = (path: string) => {
    return location.pathname.includes(path);
  };

  return (
    <Sidebar className="p-2 h-full bg-transparent [&_[data-sidebar=sidebar]]:bg-transparent [&_[data-slot=sidebar-inner]]:bg-transparent">
      <div className="bg-secondary rounded-2xl h-full flex flex-col">
        <SidebarHeader />
        
        <SidebarContent className="px-2 py-2">
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
                  <button className="flex items-center justify-between px-4 py-2.5 rounded-lg w-full hover:bg-foreground/5 transition-colors">
                    <div className="flex items-center gap-1.5">
                      <Icon
                        name="layout_grid"
                        size={16}
                        className="text-muted-foreground opacity-50"
                      />
                      <span className="text-sm text-foreground">MCPs</span>
                    </div>
                    <Icon
                      name="plus"
                      size={16}
                      className="text-muted-foreground opacity-50 hover:opacity-100 transition-opacity"
                    />
                  </button>
                </SidebarMenuItem>
                
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
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* APPS Section */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                {/* APPS Label */}
                <div className="px-4 pt-4 pb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">APPS</span>
                </div>
                
                {/* deco.cx expandable item without background */}
                <SidebarMenuItem>
                  <button
                    onClick={() => setAppsExpanded(!appsExpanded)}
                    className="flex items-center justify-between px-4 py-2.5 rounded-lg w-full hover:bg-foreground/5 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 bg-[#d0ec1a] rounded flex items-center justify-center">
                        <Icon
                          name="check"
                          size={10}
                          className="text-[#07401a]"
                        />
                      </div>
                      <span className="text-sm text-foreground">deco.cx</span>
                    </div>
                    <Icon
                      name="chevron_down"
                      size={16}
                      className={cn(
                        "text-muted-foreground opacity-50 transition-transform",
                        appsExpanded && "rotate-180"
                      )}
                    />
                  </button>
                </SidebarMenuItem>
                
                {/* Expanded items as sub-nav items */}
                {appsExpanded && (
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