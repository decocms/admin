import { cn } from "@deco/ui/lib/utils.ts";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";

export interface ResourceTab {
  id: string;
  label: string;
  count?: number;
}

export interface ResourceTabsProps {
  tabs: ResourceTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function ResourceTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
}: ResourceTabsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto no-scrollbar",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            variant="outline"
            size="sm"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "h-8 rounded-lg border border-transparent bg-transparent px-3 py-1 hover:bg-muted",
              isActive && "bg-muted border-input text-foreground font-medium",
              !isActive && "text-muted-foreground font-normal",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <Badge
                variant="secondary"
                className={cn(
                  "ml-2 h-5 min-w-5 px-1 rounded-full text-[10px] font-mono",
                  isActive
                    ? "bg-background text-foreground"
                    : "bg-muted-foreground/10 text-muted-foreground",
                )}
              >
                {tab.count}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
