import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useNavigate, useParams } from "react-router";
import { WELL_KNOWN_EMAIL_DOMAINS } from "../../constants.ts";
import { useUser } from "../../hooks/data/useUser.ts";
import { Avatar } from "../common/Avatar.tsx";
import { useSidebar } from "@deco/ui/components/sidebar.tsx";

export function TeamSelector() {
  const navigate = useNavigate();
  const user = useUser();
  const { teamSlug } = useParams();
  const { open } = useSidebar();
  const teamDomain = user.email.split("@")[1];
  const teamLabel = `${teamDomain} team`;
  const isTeamBlacklisted = WELL_KNOWN_EMAIL_DOMAINS.has(teamDomain);

  const userAvatarURL = user?.user_metadata?.avatar_url ?? undefined;
  const userName = user?.user_metadata?.full_name || user?.email;
  const userLabel = `${userName.split(" ")[0]}'s team`;

  const currentAvatarURL = teamSlug ? undefined : userAvatarURL;
  const currentName = teamSlug ? teamSlug : userName;
  const currentLabel = teamSlug ? teamLabel : userLabel;

  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
