import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface RegistryItemCardProps {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  onClick: () => void;
  onToolCall?: (toolName: string, itemId: string) => Promise<void>;
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
  onToolCall,
}: RegistryItemCardProps) {
  const initials = getInitials(name);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    // If onToolCall is provided, try to call the tool
    if (onToolCall) {
      try {
        setIsLoading(true);
        // Convert name to tool name format (e.g., "Perplexity" → "PERPLEXITY_LIST")
        const toolName = `${name.toUpperCase().replace(/\s+/g, "_")}_LIST`;
        await onToolCall(toolName, id);
      } catch (error) {
        console.error("Error calling tool:", error);
      } finally {
        setIsLoading(false);
      }
    }
    // Always call the provided onClick
    onClick();
  };

  return (
    <Card
      className="group hover:shadow-md transition-shadow rounded-2xl cursor-pointer h-[116px] relative"
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="grid grid-cols-[min-content_1fr] gap-4">
          <div className="h-10 w-10 rounded flex items-center justify-center bg-linear-to-br from-primary/20 to-primary/10 text-sm font-semibold text-primary shrink-0 relative">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : icon ? (
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
                    className="text-muted-foreground shrink-0"
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
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 rounded-2xl flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </Card>
  );
}

