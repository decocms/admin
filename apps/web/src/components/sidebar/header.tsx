import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { WELL_KNOWN_AGENT_IDS } from "../../../../../packages/sdk/src/constants.ts";

export function Header() {
  const { toggleSidebar, open } = useSidebar();
  const focusChat = useFocusChat();

  return (
    <SidebarHeader className="md:h-14 h-12 py-2 flex flex-row items-center px-4 md:px-2">
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center justify-between">
          <SidebarMenuButton asChild>
            <Button
              data-open={open}
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="w-min aspect-square"
            >
              <Icon name="dock_to_right" size={18} />
            </Button>
          </SidebarMenuButton>
          <SidebarMenuButton asChild>
            <Button
              data-open={open}
              variant="ghost"
              size="icon"
              onClick={() =>
                focusChat(WELL_KNOWN_AGENT_IDS.teamAgent, crypto.randomUUID(), {
                  history: false,
                })}
              className={cn("w-min aspect-square", !open && "hidden")}
            >
              <Icon name="edit_square" size={18} />
            </Button>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}
