import { Button } from "@deco/ui/components/button.tsx";
import {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownSeparator,
  ResponsiveDropdownTrigger,
} from "@deco/ui/components/responsive-dropdown.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Link, useParams } from "react-router";
import { WELL_KNOWN_EMAIL_DOMAINS } from "../../constants.ts";
import { useUser } from "../../hooks/data/useUser.ts";
import { Avatar } from "../common/Avatar.tsx";
import { useSidebar } from "@deco/ui/components/sidebar.tsx";
import { useBasePath } from "../../hooks/useBasePath.ts";
import { useState } from "react";
import { Input } from "@deco/ui/components/input.tsx";

interface Team {
  avatarURL: string | undefined;
  url: string;
  label: string;
  isBlacklisted: boolean;
}

function useUserTeam(): Team {
  const user = useUser();

  const avatarURL = user?.metadata?.avatar_url ?? undefined;
  const name = user?.metadata?.full_name || user?.email;
  const label = `${name.split(" ")[0]}'s team`;

  return {
    avatarURL,
    url: "/",
    label,
    isBlacklisted: false,
  };
}

function useEmailDomainTeam(): Team {
  const user = useUser();
  const teamDomain = user.email.split("@")[1];
  const teamLabel = `${teamDomain} team`;
  const isTeamBlacklisted = WELL_KNOWN_EMAIL_DOMAINS.has(teamDomain);

  return {
    avatarURL: undefined,
    url: `/${teamDomain}`,
    label: teamLabel,
    isBlacklisted: isTeamBlacklisted,
  };
}

function useCurrentTeam(): Team & { isPersonalTeam: boolean } {
  const { teamSlug } = useParams();
  const userTeam = useUserTeam();
  const emailDomainTeam = useEmailDomainTeam();

  const avatarURL = teamSlug ? undefined : userTeam.avatarURL;
  const url = teamSlug ? emailDomainTeam.url : userTeam.url;
  const label = teamSlug ? teamSlug : userTeam.label;

  const isPersonalTeam = !teamSlug;

  return {
    avatarURL,
    url,
    label,
    isBlacklisted: isPersonalTeam ? userTeam.isBlacklisted : emailDomainTeam.isBlacklisted,
    isPersonalTeam,
  };
}

/**
 * TODO(@gimenes): Change this to use the Teams API
 */
function useUserTeams() {
  const personalTeam = useUserTeam();
  const emailDomainTeam = useEmailDomainTeam();
  const { isPersonalTeam: isCurrentTeamPersonal } = useCurrentTeam();

  return isCurrentTeamPersonal
    ? [emailDomainTeam]
    : [personalTeam];
}

function CurrentTeamDropdownTrigger() {
  const { open } = useSidebar();
  const { avatarURL, label } = useCurrentTeam();

  return (
    <ResponsiveDropdownTrigger asChild>
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
          url={avatarURL}
          fallback={label}
          className="w-6 h-6"
        />
        <span className="text-xs truncate ml-2">
          {label}
        </span>
        <Icon name="unfold_more" className="text-xs ml-1" size={16} />
      </Button>
    </ResponsiveDropdownTrigger>
  );
}

function CurrentTeamDropdownOptions() {
  const withBasePath = useBasePath();
  const { avatarURL, url, label } = useCurrentTeam();

  return (
    <>
      <ResponsiveDropdownItem asChild>
        <Link to={url} className="flex items-center gap-4 cursor-pointer">
          <Avatar
            className="rounded-full w-6 h-6"
            url={avatarURL}
            fallback={label}
          />
          <span className="md:text-xs flex-grow justify-self-start">
            {label}
          </span>
        </Link>
      </ResponsiveDropdownItem>
      <ResponsiveDropdownItem asChild>
        <Link
          to={withBasePath("/settings")}
          className="flex items-center gap-4 cursor-pointer"
        >
          <span className="grid place-items-center p-1">
            <Icon name="settings" size={18} />
          </span>
          <span className="md:text-xs">
            Settings
          </span>
        </Link>
      </ResponsiveDropdownItem>
      <ResponsiveDropdownItem
        className="gap-4 cursor-pointer aria-disabled:opacity-50 aria-disabled:cursor-default aria-disabled:pointer-events-none"
        aria-disabled
      >
        <span className="grid place-items-center p-1">
          <Icon name="person_add" size={18} />
        </span>
        <span className="md:text-xs flex-grow justify-self-start">
          Add team member
        </span>
      </ResponsiveDropdownItem>
    </>
  );
}

function SwitchTeam() {
  const availableTeamsToSwitch = useUserTeams();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  
  const filteredTeams = availableTeamsToSwitch
    .filter(team => 
      team.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, 3); // Limit to 3 teams

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSearchQuery(e.target.value);
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  const toggleSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSearch(!showSearch);
    if (!showSearch) {
      // Clear search when opening
      setSearchQuery("");
    }
  };

  return (
    <>
      <div className="flex justify-between items-center px-2">
        <span className="md:text-[10px] text-xs font-medium">
          Switch team
        </span>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6"
          onClick={toggleSearch}
        >
          <Icon name="search" size={16} />
        </Button>
      </div>
      
      {showSearch && (
        <div className="p-2 hidden md:block">
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={handleSearchChange}
            onClick={handleInputClick}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-8 text-xs md:text-xs"
            autoFocus
          />
        </div>
      )}
      
      {filteredTeams.length > 0 ? (
        filteredTeams.map((team) => (
          <ResponsiveDropdownItem asChild key={team.url}>
            <Link
              to={team.url}
              className="flex items-center gap-4 cursor-pointer"
            >
              <Avatar className="w-6 h-6" url={team.avatarURL} fallback={team.label} />
              <span className="md:text-xs">
                {team.label}
              </span>
            </Link>
          </ResponsiveDropdownItem>
        ))
      ) : (
        <div className="text-xs text-center py-2 text-muted-foreground">
          No teams found
        </div>
      )}

       {showSearch && (
        <div className="p-2 md:hidden">
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={handleSearchChange}
            onClick={handleInputClick}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-8 text-xs md:text-xs"
            autoFocus
          />
        </div>
      )}
      
      <ResponsiveDropdownItem
        className="gap-4 cursor-pointer aria-disabled:opacity-50 aria-disabled:cursor-default aria-disabled:pointer-events-none"
        aria-disabled
      >
        <span className="grid place-items-center p-1">
          <Icon name="add" size={18} />
        </span>
        <span className="md:text-xs">
          Create team
        </span>
      </ResponsiveDropdownItem>
    </>
  );
}

export function TeamSelector() {
  return (
    <ResponsiveDropdown>
      <CurrentTeamDropdownTrigger />
      <ResponsiveDropdownContent align="start">
        <CurrentTeamDropdownOptions />
        <ResponsiveDropdownSeparator />
        <SwitchTeam />
      </ResponsiveDropdownContent>
    </ResponsiveDropdown>
  );
}
