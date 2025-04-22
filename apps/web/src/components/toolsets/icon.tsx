import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

interface IntegrationIconProps {
  icon?: string;
  name: string;
  className?: string;
}

export function IntegrationIcon(
  { icon, name, className }: IntegrationIconProps,
) {
  if (!icon) return null;

  if (icon.startsWith("icon://")) {
    return (
      <div
        className={cn(
          "bg-background border rounded-md p-1 h-6 w-6 flex items-center justify-center",
          className,
        )}
      >
        <Icon name={icon.replace("icon://", "")} size={16} />
      </div>
    );
  }

  return (
    <img
      src={icon}
      alt={`${name} icon`}
      className={cn(
        "bg-background h-8 w-8 object-contain border rounded-md overflow-hidden",
        className,
      )}
    />
  );
}
