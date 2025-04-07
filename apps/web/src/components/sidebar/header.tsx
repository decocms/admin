import { useRuntime } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useGlobalState } from "../../stores/global.tsx";
import { Avatar } from "../common/Avatar.tsx";

export function Header() {
  const { state: { user } } = useGlobalState();
  const { state: { context } } = useRuntime();
  const { toggleSidebar, open } = useSidebar();

  const userAvatarURL = user?.metadata?.avatar_url ?? undefined;
  const userName = user?.metadata?.full_name || user?.email;

  const currentAvatarURL = context?.type === "team" ? undefined : userAvatarURL;
  const currentName = context?.type === "team" ? context?.slug : userName;

  if (!context) {
    return null;
  }

  return (
    <SidebarHeader className="h-14 py-2 flex flex-row items-center bg-accent/30">
      <SidebarMenu>
        <SidebarMenuItem className="flex flex-row items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className={cn(
                  "flex-grow justify-start rounded-lg",
                  "px-1.5 py-1 gap-0",
                  "transition-[width,padding] overflow-hidden",
                  open ? "" : "w-0 p-0",
                )}
                variant="ghost"
              >
                <Avatar
                  url={currentAvatarURL}
                  fallback={currentName}
                  className="w-6 h-6"
                />
                <span className="text-xs truncate ml-2">
                  {currentName}
                </span>
                <Icon name="unfold_more" className="text-xs ml-1" size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {context.type === "team" && (
                <DropdownMenuItem className="gap-3">
                  <Avatar fallback={context.slug} />
                  <span className="text-xs">{context.slug}</span>
                  {context.type === "team" && (
                    <Icon name="check" className="text-xs" />
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="gap-3"
                // TODO (@gimenes): use navigate instead of globalThis.location.href
                // Some bugs are happening when using navigate
                onClick={() => globalThis.location.href = "/~"}
              >
                <Avatar
                  className="rounded-full"
                  url={userAvatarURL}
                  fallback={userName}
                />
                <span className="text-xs">{userName}</span>
                {context.type === "user" && (
                  <Icon name="check" className="text-xs" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <SidebarMenuButton asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="w-auto aspect-square hover:bg-accent rounded-full group"
            >
              <Icon
                data-open={open}
                name="dock_to_right"
                className={cn(
                  "text-xs",
                  `data-[open="false"]:!hidden group-hover:inline-block`,
                )}
                size={18}
              />

              <Avatar
                data-open={open}
                url={currentAvatarURL}
                fallback={currentName}
                className={cn(
                  "w-6 h-6",
                  `data-[open="true"]:!hidden group-hover:hidden`,
                )}
              />
            </Button>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}
