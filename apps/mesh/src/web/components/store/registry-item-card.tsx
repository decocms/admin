import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface RegistryItemCardProps {
  id: string;
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
  id,
  name,
  description,
  icon,
  onClick,
}: RegistryItemCardProps) {
  const initials = getInitials(name);

  return (
    <Card
      className="group hover:shadow-md transition-shadow rounded-2xl cursor-pointer h-[116px]"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="grid grid-cols-[min-content_1fr] gap-4">
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
          <div className="grid grid-cols-1 gap-1">
            <div className="flex items-start gap-1">
              <div className="text-sm font-semibold truncate">{name}</div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Icon
                    name="info"
                    size={14}
                    className="text-muted-foreground flex-shrink-0"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Registry Item</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-sm text-muted-foreground line-clamp-2">
              {description || "No description available"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

