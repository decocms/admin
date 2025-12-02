import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import type { MCP } from "@/web/hooks/collections/use-registry-mcps";

interface MCPToolCardProps {
  tool: MCP;
  onCardClick: (tool: MCP) => void;
}

function getInitials(name: string): string {
  return name
    .split(/[\s\-_]/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MCPToolCard({ tool, onCardClick }: MCPToolCardProps) {
  const initials = getInitials(tool.name);

  return (
    <Card
      className="group hover:shadow-md transition-shadow rounded-2xl cursor-pointer h-[116px]"
      onClick={() => onCardClick(tool)}
    >
      <CardContent className="p-4">
        <div className="grid grid-cols-[min-content_1fr] gap-4">
          <div className="h-10 w-10 rounded flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10 text-sm font-semibold text-primary flex-shrink-0">
            {initials}
          </div>
          <div className="grid grid-cols-1 gap-1">
            <div className="flex items-start gap-1">
              <div className="text-sm font-semibold truncate">{tool.name}</div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Icon
                    name="info"
                    size={14}
                    className="text-muted-foreground flex-shrink-0"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>MCP Tool</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-sm text-muted-foreground line-clamp-2">
              {tool.description || "No description available"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

