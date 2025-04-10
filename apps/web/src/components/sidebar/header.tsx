import { AUTH_URL } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { WELL_KNOWN_EMAIL_DOMAINS } from "../../constants.ts";
import { useUser } from "../../hooks/data/useUser.ts";
import { Avatar } from "../common/Avatar.tsx";

const useLogoutUrl = () => {
  const logoutUrl = useMemo(() => {
    const url = new URL(AUTH_URL);
    url.pathname = "/auth/logout";

    const next = new URL(location.pathname, globalThis.location.origin);
    url.searchParams.set("next", next.href);

    return url.href;
  }, [location.pathname]);

  return logoutUrl;
};

export function Header() {
  const navigate = useNavigate();
  const user = useUser();
  const { toggleSidebar, open } = useSidebar();
  const { teamSlug } = useParams();
  const logoutUrl = useLogoutUrl();
  const teamDomain = user.email.split("@")[1];
  const teamLabel = `${teamDomain} team`;
  const isTeamBlacklisted = WELL_KNOWN_EMAIL_DOMAINS.has(teamDomain);

  const userAvatarURL = user?.metadata?.avatar_url ?? undefined;
  const userName = user?.metadata?.full_name || user?.email;
  const userLabel = `${userName.split(" ")[0]}'s team`;

  const currentAvatarURL = teamSlug ? undefined : userAvatarURL;
  const currentName = teamSlug ? teamSlug : userName;
  const currentLabel = teamSlug ? teamLabel : userLabel;

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
                  {currentLabel}
                </span>
                <Icon name="unfold_more" className="text-xs ml-1" size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                className="gap-4 cursor-pointer"
                onClick={() => {
                  navigate("/");
                }}
              >
                <Avatar
                  className="rounded-full"
                  url={userAvatarURL}
                  fallback={userName}
                />
                <span className="text-xs flex-grow justify-self-start">
                  {userLabel}
                </span>
                <Icon
                  name="check"
                  className={cn(
                    "text-xs",
                    !teamSlug ? "opacity-100" : "opacity-0",
                  )}
                />
              </DropdownMenuItem>
              {!isTeamBlacklisted && (
                <DropdownMenuItem
                  className="gap-4 cursor-pointer"
                  onClick={() => {
                    navigate(`/${teamDomain}`);
                  }}
                >
                  <Avatar fallback={teamDomain} />
                  <span className="text-xs flex-grow justify-self-start">
                    {teamLabel}
                  </span>
                  <Icon
                    name="check"
                    className={cn(
                      "text-xs",
                      teamSlug === teamDomain ? "opacity-100" : "opacity-0",
                    )}
                  />
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={logoutUrl} className="leading-7 text-xs">
                  Log out
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <SidebarMenuButton asChild>
            <Button
              data-open={open}
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="w-auto aspect-square hover:bg-accent rounded-full group"
            >
              {/* TODO (@gimenes): we should use better CSS selectors instead of JS in here */}
              <Icon
                name="dock_to_right"
                className={cn(
                  "text-xs",
                  open ? "!inline-block" : "!hidden group-hover:!inline-block",
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
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}
