import { Icon } from "@deco/ui/components/icon.tsx";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { TeamSelector } from "./team-selector.tsx";

export function Header() {
  const { toggleSidebar, isMobile } = useSidebar();

  return (
    <SidebarHeader className="px-2 py-0">
      <SidebarMenu>
        <SidebarMenuItem className="w-full">
          <div className="flex items-center justify-between px-4 py-3 rounded-lg">
            <TeamSelector />
            <button
              onClick={toggleSidebar}
              className="p-1 hover:bg-accent/50 rounded transition-colors"
            >
              <Icon
                name={isMobile ? "menu" : "chevrons_up_down"}
                size={16}
                className="text-muted-foreground opacity-50"
              />
            </button>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}