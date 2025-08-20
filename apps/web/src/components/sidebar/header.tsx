import { Icon } from "@deco/ui/components/icon.tsx";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { TeamSelector } from "./team-selector.tsx";

export function Header() {
  const { toggleSidebar, isMobile } = useSidebar();

  return (
    <SidebarHeader className="px-2 py-0">
      <SidebarMenu>
        <SidebarMenuItem className="w-full">
          <div className="flex items-center justify-between py-3 rounded-lg min-w-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
              <TeamSelector />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 group-data-[collapsible=icon]:gap-0">
              <SidebarTrigger />
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}