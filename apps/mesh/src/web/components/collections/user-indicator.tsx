import { Avatar } from "@deco/ui/components/avatar.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";

interface UserIndicatorProps {
  userId?: string | null;
  size?:
    | "3xs"
    | "2xs"
    | "xs"
    | "sm"
    | "base"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "3xl";
}

export function UserIndicator({ userId, size = "sm" }: UserIndicatorProps) {
  if (!userId) return null;

  const avatarSize = size === "md" ? "base" : size;

  // TODO: Fetch user details (name, image) using userId
  // For now, use the ID as fallback and maybe a deterministic color if Avatar supports it,
  // or just the first char.

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Avatar
              fallback={userId.substring(0, 2).toUpperCase()}
              size={avatarSize}
              className="cursor-help"
            />
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
              {userId}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>User ID: {userId}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
