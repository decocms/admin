import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import type { ConnectionEntity } from "@/tools/connection/schema";

interface MCPCardProps {
  connection: ConnectionEntity;
  onCardClick: (connection: ConnectionEntity) => void;
}

export function VerifiedBadge() {
  return (
    <div className="relative w-4 h-4">
      <div className="absolute bg-primary rounded-full w-2 h-2 top-1 left-1" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon
            name="verified"
            size={16}
            className="absolute z-10 text-primary"
            filled
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>Verified MCP</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function getInitials(title: string): string {
  return title
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MCPCard({ connection, onCardClick }: MCPCardProps) {
  const initials = getInitials(connection.title);

  return (
    <Card
      className="group hover:shadow-md transition-shadow rounded-2xl cursor-pointer h-[116px]"
      onClick={() => onCardClick(connection)}
    >
      <CardContent className="p-4">
        <div className="grid grid-cols-[min-content_1fr] gap-4">
          <div className="h-10 w-10 rounded flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10 text-sm font-semibold text-primary flex-shrink-0">
            {connection.icon ? (
              <img
                src={connection.icon}
                alt={connection.title}
                className="h-full w-full object-cover rounded"
              />
            ) : (
              initials
            )}
          </div>
          <div className="grid grid-cols-1 gap-1">
            <div className="flex items-start gap-1">
              <div className="text-sm font-semibold truncate">
                {connection.title}
              </div>
              {connection.app_name && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Icon name="check-circle" size={14} className="text-green-500" filled />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{connection.app_name}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="text-sm text-muted-foreground line-clamp-2">
              {connection.description || "No description available"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


