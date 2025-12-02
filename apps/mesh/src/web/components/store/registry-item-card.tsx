import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface RegistryItemCardProps {
  name: string;
  description?: string;
  icon?: string;
  onClick: () => void;
}

function getInitials(name: string): string {
  return name
    .split(/[\s\-_]/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function RegistryItemCard({
  name,
  description,
  icon,
  onClick,
}: RegistryItemCardProps) {
  const initials = getInitials(name);

  return (
    <div
      onClick={onClick}
      className="flex flex-col gap-2 p-4 bg-card rounded-2xl cursor-pointer overflow-hidden border border-border hover:shadow-md transition-shadow h-[116px]"
    >
      <div className="grid grid-cols-[min-content_1fr] gap-4 h-full">
        <div className="h-10 w-10 rounded flex items-center justify-center bg-linear-to-br from-primary/20 to-primary/10 text-sm font-semibold text-primary shrink-0">
          {icon ? (
            <img
              src={icon}
              alt={name}
              className="h-full w-full object-cover rounded"
            />
          ) : (
            initials
          )}
        </div>
        <div className="grid grid-cols-1 gap-1 min-w-0">
          <div className="flex items-start gap-1">
            <div className="text-sm font-semibold truncate">{name}</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Icon
                  name="info"
                  size={14}
                  className="text-muted-foreground shrink-0"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Registry Item</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-sm text-muted-foreground line-clamp-2">
            {description || "No description avASDASDAailable"}
          </div>
        </div>
      </div>
    </div>
  );
}

