import React from "react";
import { ChevronDown, Plus, Code, Compass, LayoutGrid } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@deco/ui/lib/utils.ts";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { UniversalNavItem } from "./universal-nav-item.tsx";
import type { Collection, UnifiedNavItem } from "../../hooks/use-unified-nav-order.ts";
import { trackEvent } from "../../hooks/analytics.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";



interface InstalledApp {
  id: string;
  name: string;
  icon?: string;
  installedAt: string;
  status?: "connected" | "pending" | "disconnected";
}

interface CollectionProps {
  collection: Collection;
  onToggleCollapse: (collectionId: string) => void;
  onUninstallApp?: (appName: string) => void;
  getOrderedCollectionItems: (collection: Collection) => UnifiedNavItem[];
  installedApps?: InstalledApp[];
}

export function CollectionComponent({
  collection,
  onToggleCollapse,
  onUninstallApp,
  getOrderedCollectionItems,
  installedApps = [],
}: CollectionProps) {
  const { state } = useSidebar();
  const workspaceLink = useWorkspaceLink();

  // Make the collection header draggable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: collection.id,
    data: {
      type: "collection",
      collectionId: collection.id
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition, // Disable transition during drag
    ...(isDragging && { pointerEvents: 'none' as const }),
  };

  // Prevent toggle when dragging
  // Handle app name click - navigate to app detail page
  const handleAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDragging) return;
    
    if (collection.id.startsWith("app-")) {
      const appId = collection.id.replace("app-", "");
      window.location.href = workspaceLink(`/apps/${appId}`);
    } else if (collection.id === "deco.cx") {
      window.location.href = workspaceLink(`/apps/deco-cx`);
    }
  };

  // Handle chevron click - toggle dropdown
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDragging) return;
    
    if (collection.isCollapsible) {
      onToggleCollapse(collection.id);
    }
  };
  
  // Get app icon for app collections
  const getAppIcon = (collectionId: string) => {
    if (collectionId.startsWith("app-")) {
      const appName = collectionId.replace("app-", "");
      
      // Specific app icons
      if (appName === "deco.cx") {
        return () => (
          <div className="relative shrink-0 size-4.5 rounded overflow-hidden after:absolute after:inset-0 after:rounded after:shadow-[inset_0_0_0_1px_rgba(120,113,108,0.4)] after:pointer-events-none">
            <img 
              src="https://assets.decocache.com/decochatweb/a8ee62ed-0bf8-40fa-b1d5-ddc82fc7e201/decocxlogo.png"
              alt={appName}
              className="w-full h-full rounded object-cover"
            />
          </div>
        );
      }
      
      // Default app icon for development apps  
      if (appName !== "deco.cx") {
        return () => (
          <div className="relative shrink-0 size-4.5 rounded overflow-hidden after:absolute after:inset-0 after:rounded after:shadow-[inset_0_0_0_1px_rgba(120,113,108,0.4)] after:pointer-events-none">
            <div className="w-full h-full bg-blue-100 rounded flex items-center justify-center">
              <div className="w-2 h-2 bg-blue-600 rounded-sm" />
            </div>
          </div>
        );
      }
      
      // Default app icon for other apps
      return () => (
        <div className="relative shrink-0 size-4.5 rounded overflow-hidden after:absolute after:inset-0 after:rounded after:shadow-[inset_0_0_0_1px_rgba(120,113,108,0.4)] after:pointer-events-none">
          <div className="w-full h-full bg-primary-light rounded flex items-center justify-center">
            <div className="w-2 h-2 bg-primary-dark rounded-sm" />
          </div>
        </div>
      );
    }
    // Return the actual LayoutGrid component for MCP collection
    return LayoutGrid;
  };

  const orderedItems = getOrderedCollectionItems(collection);

  return (
    <>
      {/* Collection header - draggable */}
      <SidebarMenuItem
        ref={setNodeRef}
        style={style}
        className={cn(
          "relative",
          isDragging && "opacity-50 z-50 transition-all duration-200 shadow-lg rounded-md"
        )}
        {...attributes}
        {...listeners}
      >
                <div className="flex items-center w-full">
          <SidebarMenuButton 
            tooltip={collection.id.startsWith("app-") || collection.id === "deco.cx" ? `View ${collection.title} details` : collection.title}
            className={cn(
              "flex-1 mt-1 pl-3 cursor-pointer gap-3 overflow-hidden",
              isDragging && "cursor-grabbing"
            )}
            onClick={collection.id.startsWith("app-") || collection.id === "deco.cx" ? handleAppClick : (collection.isCollapsible ? handleToggle : undefined)}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {(() => {
                const iconResult = getAppIcon(collection.id);
                if (typeof iconResult === 'string') {
                  return <Icon name={iconResult} size={20} className="text-muted-foreground shrink-0" />;
                } else {
                  return React.createElement(iconResult as React.ComponentType<any>, { 
                    className: "text-muted-foreground shrink-0", 
                    size: 20 
                  });
                }
              })()}
              <span className="truncate min-w-0">{collection.title}</span>
            </div>
          </SidebarMenuButton>
          
          {/* Connection status button - separate like MCP plus button */}
          {collection.id.startsWith("app-") && (() => {
            const appId = collection.id.replace("app-", "");
            const app = installedApps.find(app => app.id === appId);
            const status = app?.status;
            
            // Try to find the app by ID or by name
            const appByName = installedApps.find(app => app.name === collection.title);
            const finalApp = app || appByName;
            const finalStatus = finalApp?.status;
            
            console.log('DEBUG - Collection:', collection.id, 'AppId:', appId, 'Title:', collection.title, 'Found app:', finalApp, 'Status:', finalStatus);
            
            // Show for all localhost apps with status (connected, pending, disconnected)
            if (finalStatus) {
              const tooltipText = finalStatus === "connected" ? "Connected to localhost" :
                                finalStatus === "pending" ? "Connecting to localhost..." : 
                                "Disconnected";
              
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="p-1.5 rounded hover:bg-accent mr-1 shrink-0 flex items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div 
                        className={cn(
                          "w-1.5 h-1.5 rounded-full animate-pulse",
                          finalStatus === "connected" ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" :
                          finalStatus === "pending" ? "bg-orange-400 shadow-[0_0_4px_rgba(251,146,60,0.6)]" : 
                          "bg-gray-400 shadow-[0_0_4px_rgba(156,163,175,0.6)]"
                        )}
                        style={{
                          animationDuration: '2s',
                          animationTimingFunction: 'ease-in-out'
                        }}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center">
                    {tooltipText}
                  </TooltipContent>
                </Tooltip>
              );
            }
            
            return null;
          })()}

          {/* Dropdown toggle button - separate like MCP plus button */}
          {collection.isCollapsible && (
            <button
              className="p-1 rounded hover:bg-accent mr-2 shrink-0"
              onClick={handleToggle}
              title="Toggle views"
            >
              <ChevronDown 
                size={20} 
                className={cn(
                  "text-muted-foreground opacity-50 hover:opacity-100 transition-opacity",
                  collection.isCollapsed && "-rotate-90"
                )} 
              />
            </button>
          )}
          
          {/* Add button for MCP collection */}
          {collection.id === "mcp" && state === "expanded" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1 rounded hover:bg-accent mr-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus
                    size={20}
                    className="text-muted-foreground opacity-50 hover:opacity-100 transition-opacity"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right">
                <DropdownMenuItem
                  onClick={() => {
                    trackEvent("sidebar_create_app_click");
                    // TODO: Navigate to create app page
                  }}
                >
                  <Code size={20} />
                  Create new App
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    trackEvent("sidebar_install_app_click");
                    // TODO: Navigate to install app page
                  }}
                >
                  <Compass size={20} />
                  Install App
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </SidebarMenuItem>

      {/* Collection items - nested sortable context, hide when dragging */}
      {!collection.isCollapsed && !isDragging && orderedItems.length > 0 && (
        <div className="mb-2"> {/* Add margin around collection items */}
          <SortableContext
            items={collection.itemOrder}
            strategy={verticalListSortingStrategy}
          >
            {orderedItems.map((item) => (
              <UniversalNavItem
                key={item.id}
                id={item.id}
                to={item.to}
                icon={item.icon}
                label={item.label}
                onClick={item.onClick}
                isSubItem={true}
                hierarchyLevel={item.hierarchyLevel || 1}
                appName={item.appName}
                onUninstallApp={item.appName ? onUninstallApp : undefined}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </>
  );
}
