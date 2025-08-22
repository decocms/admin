import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation } from "react-router";
import { cn } from "@deco/ui/lib/utils.ts";
import { Icon } from "@deco/ui/components/icon.tsx";
import { 
  MessageCircle, 
  Compass, 
  Briefcase, 
  LineChart, 
  LayoutGrid, 
  Plus, 
  Bot, 
  Notebook, 
  Wrench, 
  AppWindow, 
  Workflow, 
  Layers, 
  LayoutPanelTop, 
  Box, 
  ChevronDown,
  Code,
  Download,
  MoreHorizontal,
  PinOff,
  ExternalLink
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
} from "@dnd-kit/modifiers";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { trackEvent } from "../../hooks/analytics.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { SidebarFooter } from "./footer.tsx";
import { Header as SidebarHeader } from "./header.tsx";
import { useInstalledApps } from "../../hooks/use-installed-apps.ts";
import { useUnifiedNavOrder, type UnifiedNavItem, type Collection, type SidebarStructure } from "../../hooks/use-unified-nav-order.ts";
import { UniversalNavItem } from "./universal-nav-item.tsx";
import { CollectionComponent } from "./collection.tsx";

// Component for navigation items with active state
function NavItem({
  to,
  icon,
  label,
  isActive,
  onClick,
}: {
  to: string;
  icon: string | React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}) {
  const IconComponent = typeof icon === 'string' ? 
    () => <Icon name={icon} size={20} className="text-muted-foreground" /> :
    icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <Link to={to} onClick={onClick}>
          {typeof icon === 'string' ? (
            <Icon name={icon} size={20} className="text-muted-foreground" />
          ) : (
            <IconComponent className="text-muted-foreground" size={20} />
          )}
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
  icon: string | React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label} className="pl-6">
        <Link to={to} onClick={onClick}>
          {typeof icon === 'string' ? (
            <Icon name={icon} size={20} className="text-muted-foreground" />
          ) : (
            React.createElement(icon, { className: "text-muted-foreground", size: 20 })
          )}
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

interface NavItem {
  to: string;
  icon: string | React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}

interface SubNavItem {
  to: string;
  icon: string | React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  onClick?: () => void;
}

interface AppSidebarProps {
  customNavItems?: NavItem[];
  customMcpItems?: SubNavItem[];
  showDefaultNav?: boolean;
  showMcpSection?: boolean;
  showAppsSection?: boolean;
}

export function AppSidebar({
  customNavItems,
  customMcpItems,
  showDefaultNav = true,
  showMcpSection = true,
  showAppsSection = true,
}: AppSidebarProps = {}) {
  const workspaceLink = useWorkspaceLink();
  const location = useLocation();

  const { state } = useSidebar();
  const { isAppInstalled, installedApps, installApp, uninstallApp } = useInstalledApps();

  // Handle app uninstallation
  const handleUninstallApp = useCallback((appName: string) => {
    const appToUninstall = installedApps.find(app => app.name === appName);
    if (appToUninstall) {
      uninstallApp(appToUninstall.id);
    }
  }, [installedApps, uninstallApp]);
  
  // Auto-install demo apps for prototype (remove this in production)
  useEffect(() => {
    if (!isAppInstalled("deco-cx")) {
      installApp({
        id: "deco-cx",
        name: "deco.cx",
        icon: "/logos/team-agent.png"
      });
    }
    
    // Add connected development app
    if (!isAppInstalled("my-ecommerce-app")) {
      installApp({
        id: "my-ecommerce-app",
        name: "My E-commerce App",
        icon: "/logos/team-agent.png",
        status: "connected"
      });
    }
    
    // Add pending development app
    if (!isAppInstalled("blog-platform")) {
      installApp({
        id: "blog-platform",
        name: "Blog Platform",
        icon: "/logos/team-agent.png",
        status: "pending"
      });
    }
  }, [isAppInstalled, installApp]);

  const [activeId, setActiveId] = useState<string | null>(null);

  // Generate nav items for installed apps
  const generateAppNavItems = useCallback((appId: string, appName: string): UnifiedNavItem[] => {
    const appNavItems: Record<string, UnifiedNavItem[]> = {
      "deco-cx": [
        {
          id: "pages",
          to: workspaceLink("/pages"),
          icon: Layers,
          label: "Pages",
          section: "app",
          hierarchyLevel: 1,
          isSubItem: true,
          container: appName,
          appName: appName,
          onClick: () => trackEvent("sidebar_navigation_click", { item: "Pages" })
        },
        {
          id: "sections",
          to: workspaceLink("/sections"),
          icon: LayoutPanelTop,
          label: "Sections",
          section: "app",
          hierarchyLevel: 1,
          isSubItem: true,
          container: appName,
          appName: appName,
          onClick: () => trackEvent("sidebar_navigation_click", { item: "Sections" })
        },
        {
          id: "loaders",
          to: workspaceLink("/loaders"),
          icon: Box,
          label: "Loaders",
          section: "app",
          hierarchyLevel: 1,
          isSubItem: true,
          container: appName,
          appName: appName,
          onClick: () => trackEvent("sidebar_navigation_click", { item: "Loaders" })
        },
      ],
             "my-ecommerce-app": [
         {
           id: "product-catalog",
           to: workspaceLink("/apps/my-ecommerce-app/views/product-catalog"),
           icon: LayoutGrid,
           label: "Product Catalog",
           section: "app",
           hierarchyLevel: 1,
           isSubItem: true,
           container: appName,
           appName: appName,
           onClick: () => trackEvent("sidebar_navigation_click", { item: "Product Catalog View" })
         },
         {
           id: "checkout-flow",
           to: workspaceLink("/apps/my-ecommerce-app/views/checkout-flow"),
           icon: Workflow,
           label: "Checkout Flow",
           section: "app",
           hierarchyLevel: 1,
           isSubItem: true,
           container: appName,
           appName: appName,
           onClick: () => trackEvent("sidebar_navigation_click", { item: "Checkout Flow View" })
         },
         {
           id: "admin-dashboard",
           to: workspaceLink("/apps/my-ecommerce-app/views/admin-dashboard"),
           icon: LineChart,
           label: "Admin Dashboard",
           section: "app",
           hierarchyLevel: 1,
           isSubItem: true,
           container: appName,
           appName: appName,
           onClick: () => trackEvent("sidebar_navigation_click", { item: "Admin Dashboard View" })
         },
       ],
       "blog-platform": [
         // No views shown for pending apps - they need to connect first
       ]
    };
    
    return appNavItems[appId] || [];
  }, [workspaceLink]);

  // All navigation items in one unified list
  const allNavItems: UnifiedNavItem[] = useMemo(() => [
    // Main navigation - all at root level
    {
      id: "chat",
      to: workspaceLink("/chat"),
      icon: MessageCircle,
      label: "Chat",
      section: "main",
      hierarchyLevel: 0,
      isSubItem: false,
      container: "root",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Chat" })
    },
    {
      id: "discover",
      to: workspaceLink("/discover"),
      icon: Compass,
      label: "Discover",
      section: "main",
      hierarchyLevel: 0,
      isSubItem: false,
      container: "root",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Discover" })
    },
    {
      id: "bounties",
      to: workspaceLink("/bounties"),
      icon: Briefcase,
      label: "Bounties",
      section: "main",
      hierarchyLevel: 0,
      isSubItem: false,
      container: "root",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Bounties" })
    },
    {
      id: "monitor",
      to: workspaceLink("/monitor"),
      icon: LineChart,
      label: "Monitor",
      section: "main",
      hierarchyLevel: 0,
      isSubItem: false,
      container: "root",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Monitor" })
    },

    // MCP items - All at level 1 (under MCP collection header)
    {
      id: "tools",
      to: workspaceLink("/connections"),
      icon: Wrench,
      label: "Tools",
      section: "mcp",
      hierarchyLevel: 1,
      isSubItem: true,
      container: "mcp",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Tools" })
    },
    {
      id: "agents",
      to: workspaceLink("/agents"),
      icon: Bot,
      label: "Agents",
      section: "mcp",
      hierarchyLevel: 1,
      isSubItem: true,
      container: "mcp",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Agents" })
    },
    {
      id: "prompts",
      to: workspaceLink("/prompts"),
      icon: Notebook,
      label: "Prompts",
      section: "mcp",
      hierarchyLevel: 1,
      isSubItem: true,
      container: "mcp",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Prompts" })
    },
    {
      id: "views",
      to: workspaceLink("/views"),
      icon: AppWindow,
      label: "Views",
      section: "mcp",
      hierarchyLevel: 1,
      isSubItem: true,
      container: "mcp",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Views" })
    },
    {
      id: "workflows",
      to: workspaceLink("/workflows"),
      icon: Workflow,
      label: "Workflows",
      section: "mcp",
      hierarchyLevel: 1,
      isSubItem: true,
      container: "mcp",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Workflows" })
    },
    // Dynamic app items based on installed apps
    ...installedApps.flatMap((app) => 
      generateAppNavItems(app.id, app.name).map((item) => ({
        ...item,
        id: `${app.id}-${item.id}`, // Prefix with app ID to avoid conflicts
      }))
    )
  ], [workspaceLink, installedApps, generateAppNavItems]);

  const { 
    sidebarStructure,
    getOrderedRootItems,
    getOrderedCollectionItems,
    moveRootItem,
    moveItemWithinCollection,
    toggleCollectionCollapse,
    resetOrder
  } = useUnifiedNavOrder(allNavItems);



  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Get current path to determine active state
  const isActive = (path: string) => {
    return location.pathname.includes(path);
  };

  // Handle drag start
  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  // Handle drag end - simplified logic
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    
    // Check if both items are in root order (default items + collection headers)
    const isActiveInRoot = sidebarStructure.rootOrder.includes(activeId);
    const isOverInRoot = sidebarStructure.rootOrder.includes(overId);
    
    if (isActiveInRoot && isOverInRoot) {
      // Root level movement
      moveRootItem(activeId, overId);
      return;
    }
    
    // Check if both items are in the same collection
    const activeCollection = sidebarStructure.collections.find(c => 
      c.itemOrder.includes(activeId)
    );
    const overCollection = sidebarStructure.collections.find(c => 
      c.itemOrder.includes(overId)
    );
    
    if (activeCollection && overCollection && activeCollection.id === overCollection.id) {
      // Within collection movement
      moveItemWithinCollection(activeCollection.id, activeId, overId);
    }
    
    // All cross-boundary movements are blocked
  };



  return (
    <Sidebar 
      collapsible="icon" 
      className="p-2 h-full bg-transparent [&_[data-sidebar=sidebar]]:bg-transparent [&_[data-slot=sidebar-inner]]:bg-transparent"
      style={{ "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}
    >
      <div className="bg-sidebar rounded-2xl h-full flex flex-col group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-16 [&_svg]:!size-4.5 [&_svg]:!text-muted-foreground/75">
        <SidebarHeader />
        
        <SidebarContent className="px-2 group-data-[collapsible=icon]:px-1">
          {/* Unified Navigation - All items in one draggable list */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
          >
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0">
                  {/* Handle custom nav items */}
                  {customNavItems ? (
                    customNavItems.map((item) => (
                      <NavItem
                        key={item.to}
                        to={item.to}
                        icon={item.icon}
                        label={item.label}
                        isActive={item.isActive ?? isActive(item.to)}
                        onClick={item.onClick}
                      />
                    ))
                  ) : (
                    /* Main sortable context for root-level items */
                    <SortableContext
                      items={sidebarStructure.rootOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      {/* Render items in the correct order */}
                      {getOrderedRootItems().map((item: any) => {
                        if (item.type === 'default') {
                          return (
                            <UniversalNavItem
                              key={item.id}
                              id={item.id}
                              to={item.to}
                              icon={item.icon}
                              label={item.label}
                              onClick={item.onClick}
                              isSubItem={false}
                              hierarchyLevel={0}
                              appName={item.appName}
                              onUninstallApp={item.appName ? handleUninstallApp : undefined}
                            />
                          );
                        } else if (item.type === 'collection') {
                          return (
                            <CollectionComponent
                              key={item.id}
                              collection={item}
                              onToggleCollapse={toggleCollectionCollapse}
                              onUninstallApp={handleUninstallApp}
                              getOrderedCollectionItems={getOrderedCollectionItems}
                              installedApps={installedApps}
                            />
                          );
                        }
                        return null;
                      })}
                    </SortableContext>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </DndContext>
        </SidebarContent>
        
        <SidebarFooter />
      </div>
    </Sidebar>
  );
}