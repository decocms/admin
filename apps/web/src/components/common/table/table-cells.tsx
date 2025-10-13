import { useAgents, useOrganizations, useTeamMembers } from "@deco/sdk";
import { WELL_KNOWN_AGENT_IDS, WELL_KNOWN_AGENTS } from "@deco/sdk/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { format } from "date-fns";
import { useMemo } from "react";
import { useParams } from "react-router";
import { useUser } from "../../../hooks/use-user.ts";
import { IntegrationIcon } from "../../integrations/common.tsx";
import { AgentAvatar } from "../avatar/agent.tsx";
import { UserAvatar } from "../avatar/user.tsx";

interface AgentInfoProps {
  agentId?: string;
  className?: string;
  noTooltip?: boolean;
}

function AgentInfo({ agentId, className, noTooltip = false }: AgentInfoProps) {
  const { data: agents } = useAgents();
  const allAgents = useMemo(
    () => [...agents, ...Object.values(WELL_KNOWN_AGENTS)],
    [agents],
  );
  const agent = useMemo(
    () => allAgents?.find((a) => a.id === agentId),
    [allAgents, agentId],
  );

  const content = (
    <div className={`flex items-center gap-2 min-w-[48px] ${className ?? ""}`}>
      <AgentAvatar
        url={agent?.avatar}
        fallback={
          agentId === WELL_KNOWN_AGENT_IDS.teamAgent ? agentId : agent?.name
        }
        size="sm"
      />
      <span className="truncate hidden md:inline">
        {agentId === WELL_KNOWN_AGENT_IDS.teamAgent
          ? "New chat"
          : agent
            ? agent.name
            : "Deleted agent"}
      </span>
    </div>
  );

  if (noTooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>{agent ? agent.name : agentId}</TooltipContent>
    </Tooltip>
  );
}

interface UserInfoProps {
  userId?: string;
  className?: string;
  showDetails?: boolean; // If true, show name/email block (for detail view)
  maxWidth?: string; // Custom max-width for name/email text
  noTooltip?: boolean; // If true, do not wrap with tooltip
  nameOnly?: boolean; // If true, show only the user name (no avatar or email)
}

function UserInfo({
  userId,
  className,
  showDetails = false,
  maxWidth = "200px", // Default to 200px, but allow customization
  noTooltip = false,
  nameOnly = false,
}: UserInfoProps) {
  const user = useUser();
  const params = useParams();
  const resolvedOrgSlug = params.org;
  const { data: teams } = useOrganizations();
  const orgId = useMemo(
    () => teams?.find((t) => t.slug === resolvedOrgSlug)?.id ?? null,
    [teams, resolvedOrgSlug],
  );

  // If userId matches current user, use user data directly
  const isCurrentUser = userId && user && userId === user.id;

  const {
    data: { members: teamMembers = [] },
  } = useTeamMembers(orgId ?? null);
  const members = !isCurrentUser && orgId !== null ? teamMembers : [];
  const member = useMemo(
    () => members.find((m) => m.user_id === userId),
    [members, userId],
  );

  // Data source for avatar and name/email
  const avatarUrl = isCurrentUser
    ? user.metadata.avatar_url
    : member?.profiles?.metadata?.avatar_url;
  const name = isCurrentUser
    ? user.metadata.full_name
    : member?.profiles?.metadata?.full_name;

  // Helper to check if email is valid (not just an ID)
  const isValidEmail = (str?: string | null): boolean => {
    if (!str || typeof str !== "string") return false;
    // Must contain @ and match email pattern - reject numeric IDs like "4731879672448993;"
    if (!str.includes("@")) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  };

  // Try to get email from profiles.email or metadata.email, whichever is valid
  const profileEmail = member?.profiles?.email;
  const metadataEmail = member?.profiles?.metadata?.email;
  const currentUserEmail = user?.email;

  const validEmail = isCurrentUser
    ? isValidEmail(currentUserEmail)
      ? currentUserEmail
      : null
    : isValidEmail(profileEmail)
      ? profileEmail
      : isValidEmail(metadataEmail)
        ? metadataEmail
        : null;

  // Only get phone metadata if userId looks like a phone number AND we don't have a member
  // (if we have a member, the userId is a user ID, not a phone number)
  const isPhoneNumber = useMemo(() => {
    if (!userId || member) return false;

    // Exclude UUIDs (format: 8-4-4-4-12 with hex characters)
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId,
      )
    ) {
      return false;
    }

    // Phone numbers should:
    // - Start with + or digit
    // - Contain 10-15 digits after removing formatting
    // - Not contain letters (UUIDs and IDs often have letters)
    const normalized = userId.replace(/[\s\-()]/g, "");
    return /^\+?\d{10,15}$/.test(normalized);
  }, [userId, member]);

  const phoneMetadata = isPhoneNumber ? getPhoneMetadata(userId) : {};
  const { country, stateCode, formattedNumber, flagEmoji } = phoneMetadata;

  const displayName = name || "Unknown";
  // Only show email if it's actually a valid email address
  const displayEmail = validEmail ?? "";
  const avatarFallback = stateCode
    ? stateCode
    : displayName.slice(0, 1).toUpperCase();

  const content = nameOnly ? (
    <span className={`text-xs text-muted-foreground ${className ?? ""}`}>
      {name || "Unknown"}
    </span>
  ) : (
    <div className={`flex items-center gap-2 min-w-[48px] ${className ?? ""}`}>
      <div className="relative">
        <UserAvatar
          url={avatarUrl}
          fallback={avatarFallback}
          size="sm"
          className={stateCode ? "text-[13px] font-semibold" : undefined}
        />
        {flagEmoji ? (
          <span className="absolute -bottom-1 -left-1 text-[14px] drop-shadow">
            {flagEmoji}
          </span>
        ) : null}
      </div>
      <div
        className={`flex-col items-start text-left leading-tight w-full ${
          showDetails ? "hidden md:flex" : "flex"
        }`}
      >
        <span
          className="truncate block text-xs font-medium text-foreground"
          style={{ maxWidth }}
        >
          {displayName}
        </span>
        {(formattedNumber || displayEmail) && (
          <span
            className="truncate block text-xs font-normal text-muted-foreground"
            style={{ maxWidth }}
          >
            {formattedNumber || displayEmail}
          </span>
        )}
      </div>
    </div>
  );

  if (noTooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col">
          <span>{displayName}</span>
          {displayEmail ? <span>{displayEmail}</span> : null}
          {formattedNumber ? <span>{formattedNumber}</span> : null}
          {country ? (
            <span className="text-xs text-muted-foreground">{country}</span>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface DateTimeCellProps {
  value: string | Date | undefined | null;
  dateFormat?: string;
  timeFormat?: string;
  className?: string;
}

export function DateTimeCell({
  value,
  dateFormat = "MMM dd, yyyy",
  timeFormat = "HH:mm:ss",
  className = "",
}: DateTimeCellProps) {
  if (!value) {
    return <span className={className}>-</span>;
  }
  const dateObj = typeof value === "string" ? new Date(value) : value;
  return (
    <div
      className={`flex flex-col items-start text-left leading-tight ${className}`}
    >
      <span className="font-medium text-foreground">
        {format(dateObj, dateFormat)}
      </span>
      <span className="font-normal text-muted-foreground">
        {format(dateObj, timeFormat)}
      </span>
    </div>
  );
}

interface IntegrationInfoProps {
  integration?: { id?: string; icon?: string; name: string };
  toolName?: string;
  className?: string;
}

function IntegrationInfo({
  integration,
  toolName,
  className,
}: IntegrationInfoProps) {
  const integrationId = integration?.id;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex items-center gap-2 min-w-[48px] ${className ?? ""}`}
        >
          <IntegrationIcon
            icon={integration?.icon}
            name={integration?.name || integrationId || "Unknown"}
            size="sm"
          />
          <div className="flex flex-col">
            <span className="truncate hidden md:inline text-sm font-medium">
              {integration?.name || integrationId || "Unknown"}
            </span>
            {toolName && (
              <span className="text-xs text-muted-foreground truncate hidden md:inline">
                {toolName}
              </span>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col">
          <span>{integration?.name || integrationId || "Unknown"}</span>
          {toolName && <span>{toolName}</span>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface ActivityStatusCellProps {
  lastActivity?: string | Date | null;
  className?: string;
}

function ActivityStatusCell({
  lastActivity,
  className = "",
}: ActivityStatusCellProps) {
  // Helper function to format relative time
  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInMonths = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30));
    const diffInYears = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 365));

    if (diffInMinutes < 1) return "Active";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
    }
    if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
    }
    if (diffInMonths < 12) {
      return `${diffInMonths} month${diffInMonths === 1 ? "" : "s"} ago`;
    }
    return `${diffInYears} year${diffInYears === 1 ? "" : "s"} ago`;
  }

  if (!lastActivity) {
    return <span className={`text-muted-foreground ${className}`}>Never</span>;
  }

  const activityDate =
    typeof lastActivity === "string" ? new Date(lastActivity) : lastActivity;

  const relativeTime = formatRelativeTime(activityDate);
  const isActive = relativeTime === "Active";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isActive && <div className="w-2 h-2 bg-success rounded-full"></div>}
      <span className={isActive ? "text-foreground" : "text-muted-foreground"}>
        {relativeTime}
      </span>
    </div>
  );
}

interface TimeAgoCellProps {
  value: string | Date | undefined | null;
  className?: string;
}

function TimeAgoCell({ value, className = "" }: TimeAgoCellProps) {
  // Helper function to format relative time
  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInSeconds = Math.floor(diffInMs / 1000);
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInWeeks = Math.floor(diffInDays / 7);
    const diffInMonths = Math.floor(diffInDays / 30);
    const diffInYears = Math.floor(diffInDays / 365);

    if (diffInSeconds < 60) {
      return diffInSeconds <= 1 ? "1s ago" : `${diffInSeconds}s ago`;
    }
    if (diffInMinutes < 60) {
      return diffInMinutes === 1 ? "1m ago" : `${diffInMinutes}m ago`;
    }
    if (diffInHours < 24) {
      return diffInHours === 1 ? "1h ago" : `${diffInHours}h ago`;
    }
    if (diffInDays < 7) {
      return diffInDays === 1 ? "1d ago" : `${diffInDays}d ago`;
    }
    if (diffInWeeks < 4) {
      return diffInWeeks === 1 ? "1w ago" : `${diffInWeeks}w ago`;
    }
    if (diffInMonths < 12) {
      return diffInMonths === 1 ? "1mo ago" : `${diffInMonths}mo ago`;
    }
    return diffInYears === 1 ? "1y ago" : `${diffInYears}y ago`;
  }

  if (!value) {
    return <span className={className}>-</span>;
  }

  const dateObj = typeof value === "string" ? new Date(value) : value;
  const relativeTime = formatRelativeTime(dateObj);

  return <span className={className}>{relativeTime}</span>;
}

export {
  ActivityStatusCell,
  AgentInfo,
  IntegrationInfo,
  TimeAgoCell,
  UserInfo,
};

interface PhoneMetadata {
  country?: string;
  stateCode?: string;
  formattedNumber?: string;
  flagEmoji?: string;
}

const BRAZIL_STATE_CODES: Record<string, string> = {
  "11": "SP",
  "12": "SP",
  "13": "SP",
  "14": "SP",
  "15": "SP",
  "16": "SP",
  "17": "SP",
  "18": "SP",
  "19": "SP",
  "21": "RJ",
  "22": "RJ",
  "24": "RJ",
  "27": "ES",
  "28": "ES",
  "31": "MG",
  "32": "MG",
  "33": "MG",
  "34": "MG",
  "35": "MG",
  "37": "MG",
  "38": "MG",
  "41": "PR",
  "42": "PR",
  "43": "PR",
  "44": "PR",
  "45": "PR",
  "46": "PR",
  "47": "SC",
  "48": "SC",
  "49": "SC",
  "51": "RS",
  "53": "RS",
  "54": "RS",
  "55": "RS",
  "61": "DF",
  "62": "GO",
  "64": "GO",
  "63": "TO",
  "65": "MT",
  "66": "MT",
  "67": "MS",
  "68": "AC",
  "69": "RO",
  "71": "BA",
  "73": "BA",
  "74": "BA",
  "75": "BA",
  "77": "BA",
  "79": "SE",
  "81": "PE",
  "82": "AL",
  "83": "PB",
  "84": "RN",
  "85": "CE",
  "88": "CE",
  "86": "PI",
  "89": "PI",
  "87": "PE",
  "90": "PE",
  "91": "PA",
  "93": "PA",
  "94": "PA",
  "92": "AM",
  "97": "AM",
  "95": "RR",
  "96": "AP",
  "98": "MA",
  "99": "MA",
};

const BRAZIL_STATES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AM: "Amazonas",
  AP: "Amapá",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MG: "Minas Gerais",
  MS: "Mato Grosso do Sul",
  MT: "Mato Grosso",
  PA: "Pará",
  PB: "Paraíba",
  PE: "Pernambuco",
  PI: "Piauí",
  PR: "Paraná",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RO: "Rondônia",
  RR: "Roraima",
  RS: "Rio Grande do Sul",
  SC: "Santa Catarina",
  SE: "Sergipe",
  SP: "São Paulo",
  TO: "Tocantins",
};

const US_STATE_CODES: Record<string, string> = {
  "201": "NJ",
  "202": "DC",
  "203": "CT",
  "205": "AL",
  "206": "WA",
  "207": "ME",
  "208": "ID",
  "209": "CA",
  "210": "TX",
  "212": "NY",
  "213": "CA",
  "214": "TX",
  "215": "PA",
  "216": "OH",
  "217": "IL",
  "218": "MN",
  "219": "IN",
  "220": "OH",
  // ... (additional US area codes as needed)
};

const COUNTRY_FLAGS: Record<string, string> = {
  BR: "🇧🇷",
  US: "🇺🇸",
};

function getPhoneMetadata(phone?: string | null): PhoneMetadata {
  if (!phone) return {};

  const normalized = phone.replace(/[^\d+]/g, "");

  if (normalized.startsWith("+55") || normalized.startsWith("55")) {
    const digits = normalized.replace(/^\+?55/, "");
    const areaCode = digits.substring(0, 2);
    const stateCode = BRAZIL_STATE_CODES[areaCode];
    const stateName = stateCode ? BRAZIL_STATES[stateCode] : undefined;
    const localNumber = digits.substring(2);
    const formatted = `+55 ${areaCode} ${localNumber.replace(
      /(\d{4,5})(\d{4})$/,
      "$1-$2",
    )}`;

    return {
      country: stateName ? `Brazil • ${stateName}` : "Brazil",
      stateCode,
      formattedNumber: formatted,
      flagEmoji: COUNTRY_FLAGS.BR,
    };
  }

  if (normalized.startsWith("+1") || normalized.startsWith("1")) {
    const digits = normalized.replace(/^\+?1/, "");
    const areaCode = digits.substring(0, 3);
    const stateCode = US_STATE_CODES[areaCode];
    const localNumber = digits.substring(3);
    const formatted = `+1 (${areaCode}) ${localNumber.replace(
      /(\d{3})(\d{4})$/,
      "$1-$2",
    )}`;

    return {
      country: stateCode ? `United States • ${stateCode}` : "United States",
      stateCode,
      formattedNumber: formatted,
      flagEmoji: COUNTRY_FLAGS.US,
    };
  }

  return {
    formattedNumber: normalized,
  };
}
