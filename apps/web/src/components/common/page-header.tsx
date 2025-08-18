import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  icon?: string;
  actionButtons?: ReactNode;
  className?: string;
}

export function PageHeader({ title, icon, actionButtons, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between px-6 py-2 min-h-[60px]", className)}>
      <div className="flex items-center gap-2">
        {icon && <Icon name={icon} size={20} className="text-muted-foreground opacity-50" />}
        <h1 className="text-xl text-foreground font-normal">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="w-9 h-9 p-0 rounded-xl hover:bg-muted transition-colors">
          <Icon name="chat" size={18} />
        </Button>
        {actionButtons}
      </div>
    </div>
  );
}
