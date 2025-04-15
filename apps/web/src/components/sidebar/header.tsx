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
import { useParams } from "react-router";
import { useUser } from "../../hooks/data/useUser.ts";
import { useGitHubStars } from "../../hooks/useGitHubStars.ts";
import { Avatar } from "../common/Avatar.tsx";
import { TeamSelector } from "./TeamSelector.tsx";

export function Header() {
  const user = useUser();
  const { toggleSidebar, open } = useSidebar();
  const { teamSlug } = useParams();
  const { data: stars } = useGitHubStars();

  const userAvatarURL = user?.metadata?.avatar_url ?? undefined;
  const userName = user?.metadata?.full_name || user?.email;

  const currentAvatarURL = teamSlug ? undefined : userAvatarURL;
  const currentName = teamSlug ? teamSlug : userName;

  const formattedStars = stars
    ? (stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars)
    : null;

  return (
    <SidebarHeader className="md:h-14 h-12 py-2 flex flex-row items-center bg-accent/30 px-4 md:px-2">
      <SidebarMenu>
        <SidebarMenuItem className="flex flex-row items-center justify-between">
          <div className="hidden md:block">
            <TeamSelector />
          </div>

          <div className="hidden md:block">
            <SidebarMenuButton asChild>
              <Button
                data-open={open}
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="w-auto aspect-square hover:bg-accent rounded-full group"
              >
                <Icon
                  name="dock_to_right"
                  className={cn(
                    "text-xs",
                    open
                      ? "!inline-block"
                      : "!hidden group-hover:!inline-block",
                  )}
                  size={18}
                />

                <Avatar
                  url={currentAvatarURL}
                  fallback={currentName}
                  className={cn(
                    "w-6 h-6",
                    open ? "hidden" : "inline-block group-hover:hidden",
                  )}
                />
              </Button>
            </SidebarMenuButton>
          </div>

          <div className="md:hidden w-full flex justify-between items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="w-8 h-8"
            >
              <Icon name="menu" weight={300} size={20} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 py-1.5 bg-white hover:bg-gray-100"
              asChild
            >
              <a
                href="https://github.com/deco-cx/chat"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full bg-accent/30"
              >
                <img src="/img/github.svg" alt="GitHub" className="w-5 h-5" />
                {formattedStars && (
                  <span className="text-sm font-medium">{formattedStars}</span>
                )}
              </a>
            </Button>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}
