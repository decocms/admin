import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { ReactNode } from "react";

interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  children: ReactNode;
  className?: string;
}

export function ActionButton({
  onClick,
  disabled = false,
  loading = false,
  icon = "add",
  children,
  className,
}: ActionButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2 rounded-xl text-sm gap-2",
        className
      )}
    >
      {loading ? (
        <>
          <Spinner size="xs" />
          <span>{children}</span>
        </>
      ) : (
        <>
          <Icon name={icon} />
          <span className="hidden md:inline">{children}</span>
        </>
      )}
    </Button>
  );
}
