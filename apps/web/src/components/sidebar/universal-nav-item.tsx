import React from "react";
import { Link, useLocation } from "react-router";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  MoreHorizontal, 
  PinOff, 
  ExternalLink,
  Trash2
} from "lucide-react";
import { cn } from "@deco/ui/lib/utils.ts";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  SidebarMenuItem,
  SidebarMenuButton,
} from "@deco/ui/components/sidebar.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";

interface UniversalNavItemProps {
  id: string;
  to: string;
  icon: string | React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  onClick?: () => void;
  isSubItem?: boolean;
  appName?: string; // If provided, shows "from {appName}" in menu
  hierarchyLevel?: number;
  onUninstallApp?: (appName: string) => void;
}

export function UniversalNavItem({
  id,
  to,
  icon,
  label,
  onClick,
  isSubItem = false,
  appName,
  hierarchyLevel = 0,
  onUninstallApp,
}: UniversalNavItemProps) {
  const location = useLocation();
  const isActive = location.pathname.includes(to);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    data: {
      type: "nav-item",
      hierarchyLevel,
      container: hierarchyLevel > 0 ? "mcp" : "root"
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition, // Disable transition during drag
    ...(isDragging && { pointerEvents: 'none' as const }),
  };

  return (
    <SidebarMenuItem
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group/universal-item",
        isDragging && "opacity-50 z-50 scale-105 shadow-lg rounded-md",
        "transition-all duration-200"
      )}
    >
      <SidebarMenuButton 
        asChild 
        isActive={isActive} 
        tooltip={label}
        className={cn(
          "relative cursor-pointer pr-8 gap-3", // Consistent gap-3 for all items
          "transition-[background-color] duration-150 ease-out hover:transition-none",
          // Dynamic indentation based on hierarchy level
          hierarchyLevel === 0 && "pl-3",  // Root items
          hierarchyLevel === 1 && "pl-8",  // Collection items
          hierarchyLevel === 2 && "pl-12", // Nested items
          hierarchyLevel === 3 && "pl-16", // Deep nested items
          isDragging && "cursor-grabbing bg-accent/20 border border-primary/20"
        )}
        {...attributes}
        {...listeners}
      >
        <Link to={to} onClick={onClick} className="flex items-center gap-3"> {/* Consistent gap-3 */}
          {typeof icon === 'string' ? (
            <Icon name={icon} size={20} className="text-muted-foreground shrink-0" />
          ) : (
                        React.createElement(icon as React.ComponentType<any>, { 
              className: "text-muted-foreground shrink-0", 
              size: 20 
            })
          )}
          <span className="truncate">{label}</span>
        </Link>
      </SidebarMenuButton>
      
      {/* Ellipsis menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent/50",
              "opacity-0 group-hover/universal-item:opacity-100 transition-opacity",
              "z-10"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={16} className="text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-60">
          <DropdownMenuItem>
            <PinOff size={16} />
            Unpin
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              window.open(to, '_blank');
            }}
          >
            <ExternalLink size={16} />
            <span className="flex-1">Open in new tab</span>
            <ExternalLink size={16} className="ml-auto" />
          </DropdownMenuItem>
          {appName && onUninstallApp && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onUninstallApp(appName)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={16} />
                Uninstall
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
