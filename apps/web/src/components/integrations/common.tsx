import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useFile } from "@deco/sdk";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Avatar } from "../common/avatar/index.tsx";
import { Suspense } from "react";
import { isFilePath } from "../../utils/path.ts";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";

export interface IntegrationIconProps {
  icon?: string;
  className?: string;
}

export function IntegrationIcon({ icon, className }: IntegrationIconProps) {
  const fallback = (
    <Icon name="conversion_path" className="text-muted-foreground" />
  );

  const size = "w-16 h-16";
  const rounded = "rounded-xl";

  return (
    <Suspense
      fallback={
        <Skeleton
          className={cn(rounded, size, "border border-border", className)}
        />
      }
    >
      <div
        className={cn(
          rounded,
          size,
          "relative flex items-center justify-center",
          className,
        )}
      >
        {icon && isFilePath(icon)
          ? <FileAvatar path={icon} fallback={fallback} />
          : icon
          ? (
            <Avatar
              shape="square"
              url={icon}
              fallback={fallback}
              size="base"
            />
          )
          : fallback}
      </div>
    </Suspense>
  );
}

function FileAvatar({ path, fallback }: {
  path: string;
  fallback: React.ReactNode;
}) {
  const { data: fileUrl } = useFile(path);

  return (
    <Avatar
      shape="square"
      url={typeof fileUrl === "string" ? fileUrl : undefined}
      fallback={fallback}
      size="base"
    />
  );
}

export function VerifiedIntegrationBadge() {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge
          variant="outline"
          className="text-xs h-6 rounded-lg flex items-center gap-1 px-2 w-fit"
        >
          <Icon name="verified" size={16} />
          <span className="font-medium">deco.chat</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Verified connection
      </TooltipContent>
    </Tooltip>
  );
}
