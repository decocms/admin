import { Card } from "@deco/ui/components/card.tsx";
import { IntegrationIcon } from "../../../integration-icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface ConnectionCardProps {
  icon?: string | null;
  title: string;
  description?: string | null;
  className?: string;
  onClick?: () => void;
}

export function ConnectionCard({
  icon,
  title,
  description,
  className,
  onClick,
}: ConnectionCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden max-w-sm transition-colors",
        onClick && "cursor-pointer hover:bg-muted/50",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 p-3">
        <IntegrationIcon
          icon={icon}
          name={title}
          size="sm"
          className="shrink-0 shadow-sm"
        />
        <div className="flex flex-col gap-0 min-w-0 flex-1">
          <h3 className="text-sm font-medium text-foreground truncate leading-none mb-1">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            {description || "No description"}
          </p>
        </div>
        {onClick && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <Icon name="open_in_new" size={14} />
          </Button>
        )}
      </div>
    </Card>
  );
}
